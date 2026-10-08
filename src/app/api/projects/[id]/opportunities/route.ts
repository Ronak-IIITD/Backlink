import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const opps = await prisma.contentOpportunity.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 30 });
    const competitors = await prisma.competitor.findMany({ where: { projectId: params.id }, take: 10 });
    const keywords = await prisma.keyword.findMany({ where: { projectId: params.id }, take: 30 });
    const backlinks = await prisma.backlink.findMany({ where: { projectId: params.id }, take: 30 });
    const backlinkOpps = await prisma.backlinkOpportunity.findMany({ where: { projectId: params.id }, take: 30 });
    return ok({
      opps: opps.map((o) => ({ ...o, outline: safe(o.outline) })),
      competitors, keywords, backlinks, backlinkOpps,
    });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
function safe(s: string | null) {
  try { return s ? JSON.parse(s) : []; } catch { return []; }
}
