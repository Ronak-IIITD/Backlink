import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/email";
import type { RawIssue } from "@/lib/audit/rules";
import type { HealthScore } from "@/lib/audit/scoring";

export interface AlertOutcome {
  prefId: string;
  email: string;
  triggered: string[];
  sent: boolean;
  message: string;
}

function parseEvents(pref: { events: string }): string[] {
  try {
    const v = JSON.parse(pref.events);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Compare this crawl against the previous completed one and email
 * active prefs. Never throws — alerts must not fail the crawl job.
 */
export async function checkAndSendAlerts(args: {
  projectId: string;
  crawlId: string;
  projectName: string;
  websiteUrl: string;
  rawIssues: RawIssue[];
  score: HealthScore;
  failed?: { error: string };
}): Promise<AlertOutcome[]> {
  const outcomes: AlertOutcome[] = [];
  try {
    const prefs = await prisma.notificationPref.findMany({ where: { projectId: args.projectId, active: true } });
    if (!prefs.length) return outcomes;

    if (args.failed) {
      for (const p of prefs) {
        if (!parseEvents(p).includes("crawl_failed")) continue;
        try {
          const res = await sendAlertEmail({
            to: p.email, projectName: args.projectName, websiteUrl: args.websiteUrl, projectId: args.projectId,
            kind: "crawl_failed", headline: "Scan failed — safe to retry",
            details: [`The latest scan could not finish: ${args.failed.error.slice(0, 200)}`, "Nothing on your site was changed. Retrying is safe."],
            score: null, prevScore: null, whiteLabel: p.whiteLabel, agencyName: p.agencyName,
          });
          if (res.sent) await prisma.notificationPref.update({ where: { id: p.id }, data: { lastSentAt: new Date() } });
          await prisma.auditLog.create({ data: { userId: null, action: "alert.sent", entity: "project", entityId: args.projectId, meta: JSON.stringify({ kind: "crawl_failed", email: p.email, mode: res.mode }).slice(0, 1000) } });
          outcomes.push({ prefId: p.id, email: p.email, triggered: ["crawl_failed"], sent: res.sent, message: res.message });
        } catch (e: any) {
          outcomes.push({ prefId: p.id, email: p.email, triggered: ["crawl_failed"], sent: false, message: String(e?.message || e) });
        }
      }
      return outcomes;
    }

    const prev = await prisma.crawl.findFirst({
      where: { projectId: args.projectId, status: "completed", id: { not: args.crawlId } },
      orderBy: { createdAt: "desc" },
    });
    if (!prev) return outcomes; // first scan = baseline, no alerts (avoid noise)

    const [prevIssues, prevReport] = await Promise.all([
      prisma.sEOIssue.findMany({ where: { crawlId: prev.id, severity: "critical" }, select: { type: true, title: true } }),
      prisma.report.findFirst({ where: { crawlId: prev.id }, orderBy: { createdAt: "desc" } }),
    ]);
    const prevTypes = new Set(prevIssues.map((i) => i.type));
    const newCritical = args.rawIssues.filter((i) => i.severity === "critical" && !prevTypes.has(i.type));
    let prevScore: number | null = null;
    try { prevScore = JSON.parse(prevReport?.summary || "{}").overall ?? null; } catch {}

    for (const p of prefs) {
      const events = parseEvents(p);
      const triggered: string[] = [];
      if (events.includes("critical") && newCritical.length) triggered.push("critical");
      const drop = prevScore != null ? prevScore - args.score.overall : 0;
      if (events.includes("score_drop") && prevScore != null && drop >= (p.scoreDropThreshold || 10)) triggered.push("score_drop");
      if (!triggered.length) continue;

      const parts: string[] = [];
      if (triggered.includes("critical")) parts.push(`${newCritical.length} new critical issue${newCritical.length > 1 ? "s" : ""}`);
      if (triggered.includes("score_drop")) parts.push(`health ${prevScore} → ${args.score.overall}`);
      const details = [
        ...newCritical.slice(0, 4).map((i) => `[critical] ${i.title}`),
        ...(triggered.includes("score_drop") ? [`Overall health dropped ${drop} points (threshold ${p.scoreDropThreshold}).`, ...args.score.categories.filter((c) => c.score < 70).slice(0, 2).map((c) => `${c.label}: ${c.score}/100`)] : []),
      ];
      try {
        const res = await sendAlertEmail({
          to: p.email, projectName: args.projectName, websiteUrl: args.websiteUrl, projectId: args.projectId,
          kind: triggered.includes("critical") ? "critical" : "score_drop",
          headline: parts.join(" · "),
          details,
          score: args.score.overall, prevScore, whiteLabel: p.whiteLabel, agencyName: p.agencyName,
        });
        if (res.sent) await prisma.notificationPref.update({ where: { id: p.id }, data: { lastSentAt: new Date() } });
        await prisma.auditLog.create({ data: { userId: null, action: "alert.sent", entity: "project", entityId: args.projectId, meta: JSON.stringify({ kinds: triggered, email: p.email, mode: res.mode }).slice(0, 1000) } });
        outcomes.push({ prefId: p.id, email: p.email, triggered, sent: res.sent, message: res.message });
      } catch (e: any) {
        outcomes.push({ prefId: p.id, email: p.email, triggered, sent: false, message: String(e?.message || e) });
      }
    }
  } catch (e) {
    console.error("[alerts] check failed (non-fatal)", e);
  }
  return outcomes;
}

/** Send a sample alert so agencies can verify the client email + branding. */
export async function sendTestAlert(prefId: string) {
  const p = await prisma.notificationPref.findUnique({ where: { id: prefId } });
  if (!p) throw new Error("NOT_FOUND");
  const project = await prisma.project.findUnique({ where: { id: p.projectId } });
  if (!project) throw new Error("NOT_FOUND");
  const report = await prisma.report.findFirst({ where: { projectId: p.projectId }, orderBy: { createdAt: "desc" } });
  let score: number | null = null;
  try { score = JSON.parse(report?.summary || "{}").overall ?? null; } catch {}
  return sendAlertEmail({
    to: p.email, projectName: project.name, websiteUrl: project.websiteUrl, projectId: project.id,
    kind: "critical", headline: "Test alert — your notifications work",
    details: ["This is a sample so you can check branding and deliverability.", score != null ? `Latest health: ${score}/100.` : "Run an audit to include a live score."],
    score, prevScore: null, whiteLabel: p.whiteLabel, agencyName: p.agencyName,
  });
}
