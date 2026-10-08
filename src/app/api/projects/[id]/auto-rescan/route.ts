import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { z } from "zod";

const Schema = z.object({
  autoRescan: z.enum(["off", "weekly", "monthly"]),
});

function redact(p: any) {
  return { autoRescan: p.autoRescan || "off", lastAutoCrawlAt: p.lastAutoCrawlAt || null };
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    const latest = await prisma.crawl.findFirst({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });
    return ok({ ...redact(project), latestCrawl: latest ? { id: latest.id, status: latest.status, createdAt: latest.createdAt } : null });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: { autoRescan: parsed.data.autoRescan === "off" ? null : parsed.data.autoRescan },
    });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "project.rescan_update", entity: "project", entityId: params.id, meta: JSON.stringify({ autoRescan: parsed.data.autoRescan }) },
    });
    return ok(redact(updated));
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
