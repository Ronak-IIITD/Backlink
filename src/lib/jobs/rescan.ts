import { prisma } from "@/lib/db";
import { requestCrawl } from "./submit";
export async function runDueRescans(now = new Date()) {
  const projects = await prisma.project.findMany({ where: { autoRescan: { in: ["weekly", "monthly"] } }, take: 100, orderBy: { lastAutoCrawlAt: "asc" } });
  const results: { projectId: string; action: string; crawlId?: string }[] = [];
  for (const project of projects) {
    if (results.filter((r) => r.action === "enqueued").length >= 25) break;
    const interval = (project.autoRescan === "monthly" ? 30 : 7) * 86400000;
    if (project.lastAutoCrawlAt && now.getTime() - project.lastAutoCrawlAt.getTime() < interval) continue;
    try {
      const crawl = await requestCrawl(project.id, null, true);
      if (crawl.status === "queued") {
        await prisma.project.update({ where: { id: project.id }, data: { lastAutoCrawlAt: now } });
        results.push({ projectId: project.id, action: "enqueued", crawlId: crawl.id });
      } else results.push({ projectId: project.id, action: "skipped-running" });
    } catch { results.push({ projectId: project.id, action: "skipped-unavailable" }); }
  }
  return results;
}
