import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

async function latestCompletedCrawl(projectId: string) {
  return prisma.crawl.findFirst({ where: { projectId, status: "completed" }, orderBy: { createdAt: "desc" } });
}

export async function pagesHandler(projectId: string, userId: string) {
  await assertProjectAccess(userId, projectId);
  const crawl = await latestCompletedCrawl(projectId);
  if (!crawl) return ok({ crawl: null, pages: [] });
  const pages = await prisma.page.findMany({ where: { crawlId: crawl.id }, orderBy: { depth: "asc" }, take: 100 });
  return ok({ crawl, pages: pages.map((p) => ({ ...p, h2s: safe(p.h2s), links: safe(p.links)?.slice?.(0, 20), images: safe(p.images)?.slice?.(0, 10), og: safe(p.og), schemaTypes: safe(p.schemaTypes) })) });
}
function safe(s: string | null) {
  try { return s ? JSON.parse(s) : []; } catch { return []; }
}
