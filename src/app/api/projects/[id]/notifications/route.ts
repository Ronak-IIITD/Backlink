import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { z } from "zod";

const EVENTS = ["critical", "score_drop", "crawl_failed"] as const;

const CreateSchema = z.object({
  email: z.string().email().max(320),
  events: z.array(z.enum(EVENTS)).min(1).max(3),
  scoreDropThreshold: z.number().min(5).max(50).optional(),
  whiteLabel: z.boolean().default(false),
  agencyName: z.string().max(120).nullable().optional(),
  active: z.boolean().default(true),
});

function redact(p: any) {
  let events: string[] = [];
  try { events = JSON.parse(p.events); } catch {}
  return {
    id: p.id, email: p.email, events,
    scoreDropThreshold: p.scoreDropThreshold,
    whiteLabel: p.whiteLabel, agencyName: p.agencyName,
    active: p.active, lastSentAt: p.lastSentAt, createdAt: p.createdAt,
  };
}

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const rows = await prisma.notificationPref.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 20 });
    return ok({ prefs: rows.map(redact), emailMode: process.env.RESEND_API_KEY ? "resend" : "log", events: EVENTS });
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
    const row = await prisma.notificationPref.create({
      data: {
        projectId: params.id,
        email: parsed.data.email.toLowerCase().trim(),
        events: JSON.stringify(parsed.data.events),
        scoreDropThreshold: parsed.data.scoreDropThreshold ?? 10,
        whiteLabel: parsed.data.whiteLabel,
        agencyName: parsed.data.agencyName?.trim() || null,
        active: parsed.data.active,
      },
    });
    await prisma.auditLog.create({ data: { userId: u.id, action: "notify.create", entity: "project", entityId: params.id, meta: JSON.stringify({ email: row.email, events: parsed.data.events }) } });
    return ok(redact(row), 201);
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
    const prefId = url.searchParams.get("id");
    const toggle = url.searchParams.get("toggle");
    if (toggle) {
      const row = await prisma.notificationPref.findUnique({ where: { id: toggle } });
      if (!row || row.projectId !== params.id) return fail("NOT_FOUND", 404);
      const updated = await prisma.notificationPref.update({ where: { id: toggle }, data: { active: !row.active } });
      return ok(redact(updated));
    }
    if (!prefId) return fail("Missing ?id= (or ?toggle= to pause/resume).", 400);
    const row = await prisma.notificationPref.findUnique({ where: { id: prefId } });
    if (!row || row.projectId !== params.id) return fail("NOT_FOUND", 404);
    await prisma.notificationPref.delete({ where: { id: prefId } });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
