import { prisma } from "@/lib/db";
import { getSessionUser, getUserOrgIds } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

/**
 * Agency overview: all projects in user's orgs with latest health,
 * due schedules, active alerts, and pending approvals.
 * Single call for the agency dashboard.
 */
export async function GET() {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const orgIds = await getUserOrgIds(u.id);
    if (!orgIds.length) return ok({ projects: [], totals: { projects: 0, critical: 0, high: 0, dueReports: 0, firingAlerts: 0, pendingApprovals: 0 } });

    const projects = await prisma.project.findMany({
      where: { organizationId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      include: {
        crawls: { where: { status: "completed" }, orderBy: { createdAt: "desc" }, take: 1 },
        schedules: { select: { id: true, frequency: true, lastSentAt: true, email: true } },
        alertPrefs: { where: { active: true }, select: { id: true, events: true, scoreDropThreshold: true, lastSentAt: true, email: true } },
      },
    });

    const now = new Date();
    const results = await Promise.all(projects.map(async (p) => {
      const latest = p.crawls[0];
      let score: number | null = null;
      let reportDate: Date | null = null;
      let criticalCount = 0;
      let highCount = 0;
      let pendingApprovals = 0;

      if (latest) {
        const report = await prisma.report.findFirst({ where: { crawlId: latest.id }, orderBy: { createdAt: "desc" } });
        if (report) {
          try { score = JSON.parse(report.summary || "{}").overall ?? null; } catch {}
          reportDate = report.createdAt;
        }
        const issues = await prisma.sEOIssue.findMany({ where: { crawlId: latest.id, severity: { in: ["critical", "high"] } }, select: { severity: true, affectedCount: true } });
        criticalCount = issues.filter((i) => i.severity === "critical").reduce((s, i) => s + (i.affectedCount || 1), 0);
        highCount = issues.filter((i) => i.severity === "high").reduce((s, i) => s + (i.affectedCount || 1), 0);
      }

      // pending approvals across all crawls
      const crawlIds = await prisma.crawl.findMany({ where: { projectId: p.id }, select: { id: true } });
      if (crawlIds.length) {
        pendingApprovals = await prisma.aIAction.count({ where: { crawlId: { in: crawlIds.map((c) => c.id) }, status: "awaiting_approval" } });
      }

      // due schedules (no active field on ReportSchedule)
      const dueSchedules = p.schedules.filter((s) => {
        if (!s.lastSentAt) return true;
        const days = s.frequency === "monthly" ? 30 : 7;
        return now.getTime() - new Date(s.lastSentAt).getTime() >= days * 24 * 3600 * 1000;
      }).length;

      // firing alerts (recently sent in last 24h)
      const firingAlerts = p.alertPrefs.filter((a) => a.lastSentAt && now.getTime() - new Date(a.lastSentAt).getTime() < 24 * 3600 * 1000).length;

      return {
        id: p.id,
        name: p.name,
        websiteUrl: p.websiteUrl,
        score,
        reportDate,
        criticalCount,
        highCount,
        pendingApprovals,
        dueSchedules,
        firingAlerts,
        autoRescan: p.autoRescan || "off",
        lastAutoCrawlAt: p.lastAutoCrawlAt,
        latestCrawlStatus: latest?.status || "never",
      };
    }));

    const totals = {
      projects: results.length,
      critical: results.reduce((s, r) => s + r.criticalCount, 0),
      high: results.reduce((s, r) => s + r.highCount, 0),
      dueReports: results.reduce((s, r) => s + r.dueSchedules, 0),
      firingAlerts: results.reduce((s, r) => s + r.firingAlerts, 0),
      pendingApprovals: results.reduce((s, r) => s + r.pendingApprovals, 0),
    };

    return ok({ projects: results, totals });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}