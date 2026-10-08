import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const { searchParams } = new URL(req.url);
    const severity = searchParams.get("severity");
    const crawl = await prisma.crawl.findFirst({ where: { projectId: params.id, status: "completed" }, orderBy: { createdAt: "desc" } });
    if (!crawl) return ok({ crawl: null, issues: [] });
    const issues = await prisma.sEOIssue.findMany({
      where: { crawlId: crawl.id, ...(severity ? { severity } : {}) },
      orderBy: [{ severity: "asc" }, { affectedCount: "desc" }],
      take: 100,
    });
    // severity asc is alphabetical; reorder critical→high→medium→low in code
    const order: any = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
    return ok({ crawl, issues: issues.map((i) => ({ ...i, affectedUrls: safeArr(i.affectedUrls) })) });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
function safeArr(s: string) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
