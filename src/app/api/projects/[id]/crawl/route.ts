import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { enqueueCrawl } from "@/lib/jobs/queue";
import { ok, fail, toStatus } from "@/lib/api";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    // prevent concurrent runs
    const running = await prisma.crawl.findFirst({ where: { projectId: params.id, status: { in: ["queued", "running"] } } });
    if (running) return ok(running);
    const crawl = await prisma.crawl.create({ data: { projectId: params.id, status: "queued", progress: JSON.stringify({ phase: "queued", message: "Queued…" }) } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "crawl.start", entity: "crawl", entityId: crawl.id } });
    enqueueCrawl(crawl.id);
    return ok(crawl, 201);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const crawls = await prisma.crawl.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 10 });
    return ok(crawls);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
