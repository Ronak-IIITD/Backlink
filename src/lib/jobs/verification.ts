import { prisma } from "@/lib/db";
import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "@/lib/audit/rules";
export function fixResolved(payload: string | null, pages: ParsedPage[], issues: RawIssue[]) {
  try {
    const data = JSON.parse(payload || "{}");
    if (!data.issueType || !Array.isArray(data.urls) || data.urls.length !== 1) return false;
    const target = data.urls[0];
    const page = pages.find((p) => p.url === target || p.finalUrl === target);
    if (!page || page.statusCode !== 200 || page.auditError || !/html/i.test(page.contentType)) return false;
    return !issues.some((issue) => issue.type === data.issueType && issue.affectedUrls.some((url) => url === page.url || url === page.finalUrl));
  } catch { return false; }
}
export async function verifyReportedFixes(projectId: string, crawlId: string, pages: ParsedPage[], issues: RawIssue[], startedAt: Date) {
  const old = await prisma.crawl.findMany({ where: { projectId, id: { not: crawlId } }, select: { id: true } });
  const actions = await prisma.aIAction.findMany({ where: { crawlId: { in: old.map((c) => c.id) }, status: "reported_updated", reportedAt: { lt: startedAt } }, include: { issue: true } });
  for (const action of actions) {
    let originalType: string | undefined;
    try { originalType = JSON.parse(action.payload || "{}").issueType; } catch {}
    if (action.issue && action.issue.type === originalType && fixResolved(action.payload, pages, issues)) {
      await prisma.aIAction.updateMany({ where: { id: action.id, status: "reported_updated" }, data: { status: "verified", verifiedAt: new Date(), verificationCrawlId: crawlId } });
    }
  }
}
