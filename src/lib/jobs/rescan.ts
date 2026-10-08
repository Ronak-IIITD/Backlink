import { prisma } from "@/lib/db";
import { enqueueCrawl } from "./queue";

const MAX_PER_RUN = 25;

function periodMs(freq: string): number {
  return freq === "monthly" ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
}

export interface RescanResult {
  projectId: string;
  websiteUrl: string;
  action: "enqueued" | "skipped-running" | "skipped-fresh";
  crawlId?: string;
  message: string;
}

/** Find due auto-rescan projects and enqueue crawls. Skips sites with a live run. */
export async function runDueRescans(now = new Date()): Promise<RescanResult[]> {
  const projects = await prisma.project.findMany({
    where: { autoRescan: { in: ["weekly", "monthly"] } },
    take: MAX_PER_RUN * 2,
  });
  const results: RescanResult[] = [];
  for (const p of projects) {
    if (results.filter((r) => r.action === "enqueued").length >= MAX_PER_RUN) break;
    const freq = p.autoRescan || "weekly";
    const last = p.lastAutoCrawlAt ? new Date(p.lastAutoCrawlAt).getTime() : 0;
    if (last && now.getTime() - last < periodMs(freq)) {
      results.push({ projectId: p.id, websiteUrl: p.websiteUrl, action: "skipped-fresh", message: `Last auto-crawl ${new Date(last).toLocaleDateString()} — not due.` });
      continue;
    }
    const running = await prisma.crawl.findFirst({
      where: { projectId: p.id, status: { in: ["queued", "running"] } },
    });
    if (running) {
      results.push({ projectId: p.id, websiteUrl: p.websiteUrl, action: "skipped-running", message: "A crawl is already running — left alone." });
      continue;
    }
    const crawl = await prisma.crawl.create({
      data: { projectId: p.id, status: "queued", progress: JSON.stringify({ phase: "queued", message: "Queued by auto-rescan…" }) },
    });
    await prisma.project.update({ where: { id: p.id }, data: { lastAutoCrawlAt: now } });
    await prisma.auditLog.create({ data: { userId: null, action: "crawl.auto_start", entity: "crawl", entityId: crawl.id, meta: JSON.stringify({ frequency: freq }) } });
    enqueueCrawl(crawl.id);
    results.push({ projectId: p.id, websiteUrl: p.websiteUrl, action: "enqueued", crawlId: crawl.id, message: `Auto-rescan enqueued (${freq}).` });
  }
  return results;
}
