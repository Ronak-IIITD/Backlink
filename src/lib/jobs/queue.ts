import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/crawler/crawler";
import { getCrawlDefaults } from "@/lib/crawler/types";
import { hashBody } from "@/lib/crawler/parser";
import { runSeoRules, sortIssues } from "@/lib/audit/rules";
import { calculateScore } from "@/lib/audit/scoring";
import { strategistAgent, contentOppsAgent } from "@/lib/ai/orchestrator";
import { checkAndSendAlerts } from "./alerts";

/**
 * Async job architecture (in-process for MVP, swappable with Redis/BullMQ).
 * Flow: queued → running (crawl → audit → AI) → completed|failed. UI polls.
 */

async function setProgress(crawlId: string, phase: string, message: string, extra?: any) {
  await prisma.crawl.update({
    where: { id: crawlId },
    data: { progress: JSON.stringify({ phase, message, ...extra, at: new Date().toISOString() }) },
  }).catch(() => {});
}

export async function runCrawlJob(crawlId: string) {
  const started = Date.now();
  try {
    const crawl = await prisma.crawl.findUnique({ where: { id: crawlId }, include: { project: true } });
    if (!crawl) return;
    await prisma.crawl.update({ where: { id: crawlId }, data: { status: "running", startedAt: new Date() } });
    await setProgress(crawlId, "crawl", "Scanning website…");

    const opts = getCrawlDefaults();
    const { pages, errors } = await crawlSite(crawl.project.websiteUrl, opts, async (p) => {
      await setProgress(crawlId, p.phase, p.message, { found: p.found, crawled: p.crawled });
      await prisma.crawl.update({ where: { id: crawlId }, data: { pagesFound: p.found, pagesCrawled: p.crawled } }).catch(() => {});
    });

    await setProgress(crawlId, "audit", `Analyzing ${pages.length} pages…`);
    // persist pages
    for (const p of pages) {
      await prisma.page.create({
        data: {
          crawlId,
          url: p.url.slice(0, 1000),
          finalUrl: p.finalUrl.slice(0, 1000),
          statusCode: p.statusCode,
          contentType: (p.contentType || "").slice(0, 200),
          title: (p.title || null)?.slice(0, 500),
          metaDescription: (p.metaDescription || null)?.slice(0, 1000),
          canonical: (p.canonical || null)?.slice(0, 1000),
          h1: (p.h1 || null)?.slice(0, 500),
          h2s: JSON.stringify(p.h2s),
          bodyText: p.bodyText.slice(0, 20000),
          bodyHash: hashBody(p.bodyText),
          wordCount: p.wordCount,
          links: JSON.stringify(p.links.slice(0, 200)),
          images: JSON.stringify(p.images.slice(0, 60)),
          altMissingCount: p.altMissingCount,
          og: JSON.stringify(p.og),
          schemaTypes: JSON.stringify(p.schemaTypes),
          robotsDirectives: JSON.stringify(p.robotsDirectives),
          indexable: p.indexable,
          sizeBytes: p.sizeBytes,
          loadMs: p.loadMs,
          depth: p.depth,
        },
      });
    }

    // deterministic audit
    const rawIssues = sortIssues(runSeoRules(pages));
    await setProgress(crawlId, "ai", "Generating recommendations…");
    for (const ri of rawIssues) {
      await prisma.sEOIssue.create({
        data: {
          crawlId,
          type: ri.type,
          severity: ri.severity,
          title: ri.title.slice(0, 300),
          whatWrong: ri.whatWrong.slice(0, 2000),
          whyMatters: ri.whyMatters.slice(0, 2000),
          recommendation: ri.recommendation.slice(0, 2000),
          impact: ri.impact,
          difficulty: ri.difficulty,
          affectedUrls: JSON.stringify(ri.affectedUrls.slice(0, 50)),
          affectedCount: ri.affectedUrls.length,
          source: "rule",
        },
      });
    }

    // AI orchestration: planner → strategist + content in parallel → verifier already inside agents
    // Streams granular AI steps to progress so UI polling feels live.
    const project = crawl.project as any;
    await setProgress(crawlId, "ai", "Planning ranked actions…", { stage: "planner", step: 1, total: 5 });
    const aiStart = Date.now();
    const aiStep = async (msg: string) => {
      await setProgress(crawlId, "ai", msg, { stage: "agent", at: new Date().toISOString() });
    };
    const [stratRes, opps] = await Promise.all([
      strategistAgent(
        pages,
        rawIssues,
        {
          businessName: project.businessName,
          targetCountry: project.targetCountry,
          targetCity: project.targetCity,
        },
        { onStep: aiStep, projectId: crawl.projectId }
      ),
      (async () => {
        await aiStep(`Finding content gaps across ${pages.length} pages…`);
        const o = await contentOppsAgent(pages);
        await aiStep(`Found ${o.length} content opportunities`);
        return o;
      })(),
    ]);
    await setProgress(crawlId, "ai", `Verified ${stratRes.recs.length} actions against crawl evidence…`, { stage: "verifier" });
    const { recs, plan, usage } = stratRes;
    for (const r of recs) {
      await prisma.recommendation.create({
        data: {
          crawlId,
          category: r.category,
          priority: r.priority,
          bucket: r.bucket,
          whatWrong: r.whatWrong.slice(0, 2000),
          whyMatters: r.whyMatters.slice(0, 2000),
          whatToChange: r.whatToChange.slice(0, 2000),
          canAutomate: r.canAutomate,
          needsApproval: r.needsApproval,
          relatedIssueType: r.relatedIssueType,
          affectedUrls: JSON.stringify(r.affectedUrls.slice(0, 20)),
          confidence: r.confidence,
        },
      });
    }
    await prisma.agentRun.create({
      data: {
        projectId: crawl.projectId, crawlId, agent: "strategist",
        input: JSON.stringify({ pages: pages.length, issues: rawIssues.length, plan: plan.steps.length }).slice(0, 5000),
        output: JSON.stringify({ recs: recs.length, plan: plan.steps.map((s) => s.id), createdBy: plan.createdBy }).slice(0, 5000),
        tokensUsed: usage.tokens, costUsd: usage.cost, durationMs: usage.durationMs ?? (Date.now() - aiStart), status: "completed",
      },
    });
    await prisma.agentRun.create({
      data: {
        projectId: crawl.projectId, crawlId, agent: "content",
        input: JSON.stringify({ pages: pages.length }).slice(0, 2000),
        output: JSON.stringify({ opps: opps.length }).slice(0, 2000),
        tokensUsed: 0, costUsd: 0, durationMs: Date.now() - aiStart, status: "completed",
      },
    });
    for (const o of opps) {
      await prisma.contentOpportunity.create({
        data: {
          projectId: crawl.projectId, topic: o.topic.slice(0, 300), intent: o.intent,
          targetKeyword: o.targetKeyword.slice(0, 200), pageType: o.pageType,
          outline: JSON.stringify(o.outline), suggestedTitle: o.suggestedTitle.slice(0, 300),
        },
      }).catch(() => {});
    }

    // score + report
    const score = calculateScore(pages, rawIssues);
    const topRecs = recs.slice(0, 4).map((r, i) => `${i + 1}. ${r.whatWrong} → ${r.whatToChange}`).join("\n");
    const markdown = `# SEO Report — ${crawl.project.websiteUrl}\n\nSEO HEALTH: ${score.overall}/100\n\n## Biggest problems\n${rawIssues.slice(0, 5).map((i) => `- [${i.severity}] ${i.title}`).join("\n") || "- none"}\n\n## This week's recommendation\n${topRecs || "Keep monitoring."}\n\n*Crawl errors: ${errors.length}. Pages: ${pages.length}.*`;
    await prisma.report.create({
      data: {
        projectId: crawl.projectId, crawlId,
        summary: JSON.stringify(score).slice(0, 20000),
        markdown,
      },
    });

    await prisma.crawl.update({
      where: { id: crawlId },
      data: { status: "completed", finishedAt: new Date(), pagesFound: pages.length, pagesCrawled: pages.length, progress: JSON.stringify({ phase: "done", message: "Scan complete" }) },
    });

    // alerts: compare vs previous scan, email prefs (never fails the job)
    await setProgress(crawlId, "done", "Scan complete — checking alerts…").catch(() => {});
    await checkAndSendAlerts({
      projectId: crawl.projectId, crawlId,
      projectName: (crawl.project as any).name || crawl.project.websiteUrl,
      websiteUrl: crawl.project.websiteUrl,
      rawIssues, score,
    });
    await prisma.crawl.update({
      where: { id: crawlId },
      data: { progress: JSON.stringify({ phase: "done", message: "Scan complete" }) },
    }).catch(() => {});
  } catch (e: any) {
    console.error("[job] crawl failed", crawlId, e);
    await prisma.crawl.update({
      where: { id: crawlId },
      data: { status: "failed", finishedAt: new Date(), error: String(e?.message || e).slice(0, 2000), progress: JSON.stringify({ phase: "failed", message: String(e?.message || "failed") }) },
    }).catch(() => {});
    try {
      const failed = await prisma.crawl.findUnique({ where: { id: crawlId }, include: { project: true } });
      if (failed) {
        await checkAndSendAlerts({
          projectId: failed.projectId, crawlId,
          projectName: (failed.project as any).name || failed.project.websiteUrl,
          websiteUrl: failed.project.websiteUrl,
          rawIssues: [], score: { overall: 0, categories: [], counts: { critical: 0, high: 0, medium: 0, low: 0 } },
          failed: { error: String(e?.message || e).slice(0, 300) },
        });
      }
    } catch {}
  }
}

/** Fire-and-forget (in-process). For prod, replace with BullMQ enqueue. */
export function enqueueCrawl(crawlId: string) {
  // don't await — let request return fast; UI polls GET crawl
  setImmediate(() => {
    runCrawlJob(crawlId).catch((e) => console.error("[job] unhandled", e));
  });
}
