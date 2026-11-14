import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/crawler/crawler";
import { getCrawlDefaults } from "@/lib/crawler/types";
import { hashBody } from "@/lib/crawler/parser";
import { runSeoRules, sortIssues } from "@/lib/audit/rules";
import { calculateScore } from "@/lib/audit/scoring";
import { strategistAgent, contentOppsAgent } from "@/lib/ai/orchestrator";
import { currentAccess, settleUsage, settleUsageTx, transaction } from "@/lib/pilot/access";
import { verifyReportedFixes } from "./verification";
import { checkAndSendAlerts } from "./alerts";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export async function runCrawlJob(crawlId: string, finalAttempt = true) {
  const crawl = await prisma.crawl.findUnique({ where: { id: crawlId }, include: { project: true } });
  if (!crawl || !["queued", "running"].includes(crawl.status)) return;
  const leaseToken = randomUUID(), startedAt = new Date();
  const claimed = await prisma.crawl.updateMany({ where: { id: crawlId, status: { in: ["queued", "running"] }, activeProjectId: crawl.projectId, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: startedAt } }] },
    data: { status: "running", startedAt, leaseToken, leaseExpiresAt: new Date(Date.now() + 1200000), error: null } });
  if (!claimed.count) throw new Error("Crawl already has a live worker lease");
  const heartbeat = setInterval(() => {
    prisma.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { leaseExpiresAt: new Date(Date.now() + 1200000) } }).catch(() => {});
  }, 60000);
  const progress = async (phase: string, message: string, extra: object = {}) => {
    const updated = await prisma.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { progress: JSON.stringify({ phase, message, ...extra, at: new Date().toISOString() }) } });
    if (!updated.count) throw new Error("Worker lease was lost");
  };
  try {
    await currentAccess(prisma, crawl.project.organizationId);
    await prisma.$transaction([
      prisma.aIAction.deleteMany({ where: { crawlId } }), prisma.sEOIssue.deleteMany({ where: { crawlId } }),
      prisma.recommendation.deleteMany({ where: { crawlId } }), prisma.page.deleteMany({ where: { crawlId } }),
      prisma.report.deleteMany({ where: { crawlId } }), prisma.agentRun.deleteMany({ where: { crawlId } }),
      prisma.contentOpportunity.deleteMany({ where: { crawlId } }),
    ]);
    const { pages, errors, coverage } = await crawlSite(crawl.project.websiteUrl, {
      ...getCrawlDefaults(), renderMode: crawl.project.renderMode === "html" ? "html" : "javascript",
      organizationId: crawl.project.organizationId, crawlId,
    }, async (p) => {
      await progress(p.phase, p.message, { found: p.found, crawled: p.crawled });
      await prisma.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { pagesFound: p.found, pagesCrawled: p.crawled } });
    });
    await prisma.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { coverage: JSON.stringify(coverage), scoreVersion: 2 } });
    for (const p of pages) {
      await prisma.page.create({ data: {
        crawlId, url: p.url.slice(0, 2000), finalUrl: p.finalUrl.slice(0, 2000), statusCode: p.statusCode,
        contentType: p.contentType.slice(0, 200), title: p.title?.slice(0, 500), metaDescription: p.metaDescription?.slice(0, 1000),
        canonical: p.canonical?.slice(0, 2000), h1: p.h1?.slice(0, 500), h1Count: p.h1Count,
        h2s: JSON.stringify(p.h2s), bodyText: p.bodyText.slice(0, 20000), bodyHash: hashBody(p.bodyText), wordCount: p.wordCount,
        links: JSON.stringify(p.links.slice(0, 200)), images: JSON.stringify(p.images.slice(0, 100)), altMissingCount: p.altMissingCount,
        og: JSON.stringify(p.og), schemaTypes: JSON.stringify(p.schemaTypes), robotsDirectives: JSON.stringify(p.robotsDirectives),
        indexable: p.indexable, sizeBytes: p.sizeBytes, loadMs: p.loadMs, depth: p.depth, rendered: !!p.rendered, auditError: p.auditError?.slice(0, 500),
      } });
    }
    if (!coverage.audited) throw new Error(`No usable HTML could be audited. ${errors[0]?.error?.slice(0, 200) || "Review the website and rendering settings, then retry."}`);
    await progress("audit", `Analyzing ${coverage.audited} audited pages…`);
    const issues = sortIssues(runSeoRules(pages));
    for (const issue of issues) {
      await prisma.sEOIssue.create({ data: { ...issue, crawlId, source: "rule", title: issue.title.slice(0, 300),
        whatWrong: issue.whatWrong.slice(0, 2000), whyMatters: issue.whyMatters.slice(0, 2000), recommendation: issue.recommendation.slice(0, 2000),
        affectedUrls: JSON.stringify(issue.affectedUrls), affectedCount: issue.affectedUrls.length } });
    }
    const auditedPages = pages.filter((p) => !p.auditError);
    const aiStarted = Date.now();
    const [strategy, opportunities] = await Promise.all([
      strategistAgent(auditedPages, issues, { businessName: crawl.project.businessName || undefined, targetCountry: crawl.project.targetCountry || undefined, targetCity: crawl.project.targetCity || undefined },
        { projectId: crawl.projectId, onStep: (message) => progress("ai", message) }),
      contentOppsAgent(auditedPages),
    ]);
    for (const rec of strategy.recs) {
      await prisma.recommendation.create({ data: { ...rec, crawlId, affectedUrls: JSON.stringify(rec.affectedUrls) } });
    }
    await prisma.agentRun.create({ data: { projectId: crawl.projectId, crawlId, agent: "strategist", tokensUsed: strategy.usage.tokens,
      costUsd: strategy.usage.cost, durationMs: Date.now() - aiStarted, output: JSON.stringify({ model: strategy.usage.model, recommendations: strategy.recs.length }) } });
    for (const opportunity of opportunities) {
      await prisma.contentOpportunity.create({ data: { ...opportunity, projectId: crawl.projectId, crawlId, outline: JSON.stringify(opportunity.outline) } });
    }
    const score = calculateScore(pages, issues);
    const summary = { ...score, coverage };
    const markdown = `# SEO report — ${crawl.project.websiteUrl}\n\nHealth: ${score.overall ?? "Unavailable"}/100\n\nCoverage: ${coverage.audited} audited of ${coverage.attempted} attempted URLs${coverage.partial ? "; incomplete coverage" : ""}.\n\n## Prioritized findings\n${issues.slice(0, 5).map((issue) => `- [${issue.severity}] ${issue.title}`).join("\n") || "No findings in the audited sample."}\n\n## Next actions\n${strategy.recs.slice(0, 4).map((rec) => `- ${rec.whatWrong}: ${rec.whatToChange}`).join("\n")}\n\nThese are audit heuristics, not a prediction of rankings. ${errors.length} crawl warning(s).`;
    await prisma.report.create({ data: { projectId: crawl.projectId, crawlId, summary: JSON.stringify(summary), markdown } });
    await verifyReportedFixes(crawl.projectId, crawlId, pages, issues, startedAt);
    await transaction(async (tx) => {
      await settleUsageTx(tx, crawl.reservationId, true);
      const completed = await tx.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { status: "completed", finishedAt: new Date(), activeProjectId: null,
      leaseToken: null, leaseExpiresAt: null, pagesFound: coverage.discovered, pagesCrawled: coverage.audited,
      progress: JSON.stringify({ phase: "done", message: coverage.partial ? "Audit complete with limited coverage" : "Audit complete" }) } });
      if (!completed.count) throw new Error("Worker lease was lost before completion");
    });
    console.info(JSON.stringify({ event: "audit.completed", crawlId, organizationId: crawl.project.organizationId, durationMs: Date.now() - startedAt.getTime(), coverage }));
    // Coverage changes are not evidence of a score drop. Never compare partial audits.
    if (!coverage.partial) await checkAndSendAlerts({ projectId: crawl.projectId, crawlId, projectName: crawl.project.name,
      websiteUrl: crawl.project.websiteUrl, rawIssues: issues, score }).catch(() => {});
  } catch (error) {
    console.error(JSON.stringify({ event: "audit.failed", crawlId, finalAttempt, type: (error as Error).name }));
    await prisma.crawl.updateMany({ where: { id: crawlId, leaseToken }, data: { status: finalAttempt ? "failed" : "queued", finishedAt: finalAttempt ? new Date() : null,
      activeProjectId: finalAttempt ? null : crawl.projectId, leaseToken: null, leaseExpiresAt: null,
      error: (error as Error).message.slice(0, 500), progress: JSON.stringify({ phase: finalAttempt ? "failed" : "queued", message: finalAttempt ? (error as Error).message : "Retrying audit after a temporary failure…" }) } });
    if (finalAttempt) await settleUsage(crawl.reservationId, false);
    throw error;
  } finally { clearInterval(heartbeat); }
}
let connection: IORedis | undefined;
let queue: Queue<{ crawlId: string }> | undefined;
export function getCrawlQueue() {
  if (!process.env.REDIS_URL) return undefined;
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 10000 });
    connection.on("error", () => {});
  }
  queue ??= new Queue("crawl", { connection });
  return queue;
}
export async function enqueueCrawl(crawlId: string) {
  const queue = getCrawlQueue();
  if (queue) {
    await queue.add("crawl", { crawlId }, { jobId: crawlId, attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: 1000, removeOnFail: 1000 });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("REDIS_URL is required for production crawls");
  setImmediate(() => { runCrawlJob(crawlId).catch(() => console.error("[crawl] failed", { crawlId })); });
}
