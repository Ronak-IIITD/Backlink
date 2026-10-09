import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const crawl = await prisma.crawl.findFirst({ where: { projectId: params.id, status: "completed" }, orderBy: { createdAt: "desc" } });
    if (!crawl) return ok({ crawl: null, recommendations: [] });
    const recs = await prisma.recommendation.findMany({ where: { crawlId: crawl.id }, orderBy: { priority: "desc" }, take: 50 });
    return ok({ crawl, recommendations: recs.map((r) => ({ ...r, affectedUrls: safeArr(r.affectedUrls) })) });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
function safeArr(s: string) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
