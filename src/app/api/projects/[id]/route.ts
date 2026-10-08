import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    const latestCrawl = await prisma.crawl.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } });
    let score: any = null;
    let report: any = null;
    if (latestCrawl?.status === "completed") {
      report = await prisma.report.findFirst({ where: { crawlId: latestCrawl.id }, orderBy: { createdAt: "desc" } });
      if (report) {
        try { score = JSON.parse(report.summary); } catch {}
      }
    }
    const counts = latestCrawl?.status === "completed"
      ? {
          issues: await prisma.sEOIssue.count({ where: { crawlId: latestCrawl.id } }),
          critical: await prisma.sEOIssue.count({ where: { crawlId: latestCrawl.id, severity: "critical" } }),
          pages: await prisma.page.count({ where: { crawlId: latestCrawl.id } }),
        }
      : null;
    return ok({ project, latestCrawl, score, report, counts });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
