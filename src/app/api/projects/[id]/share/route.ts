import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { newShareToken, expiryFromDays } from "@/lib/share";
import { z } from "zod";

const CreateSchema = z.object({
  label: z.string().max(120).optional(),
  days: z.number().min(1).max(90).optional(),
});

function redact(s: any) {
  return { id: s.id, label: s.label, scope: s.scope, expiresAt: s.expiresAt, createdAt: s.createdAt, expired: new Date(s.expiresAt) < new Date() };
}

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const links = await prisma.shareLink.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return ok(links.map(redact));
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    const { raw, hash } = newShareToken();
    const link = await prisma.shareLink.create({
      data: {
        projectId: params.id,
        tokenHash: hash,
        label: parsed.data.label?.trim() || "Client review",
        scope: "approve",
        expiresAt: expiryFromDays(parsed.data.days ?? 30),
      },
    });
    await prisma.auditLog.create({ data: { userId: u.id, action: "share.create", entity: "project", entityId: params.id, meta: JSON.stringify({ label: link.label }) } });
    const base = (process.env.APP_URL || "").replace(/\/$/, "");
    return ok({ ...redact(link), url: `${base}/share/${raw}`, token: raw }, 201);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const url = new URL(req.url);
    const linkId = url.searchParams.get("id");
    if (!linkId) return fail("Missing ?id=", 400);
    const link = await prisma.shareLink.findUnique({ where: { id: linkId } });
    if (!link || link.projectId !== params.id) return fail("NOT_FOUND", 404);
    await prisma.shareLink.delete({ where: { id: linkId } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "share.revoke", entity: "project", entityId: params.id } });
    return ok({ revoked: true });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
