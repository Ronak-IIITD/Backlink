import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { transaction, currentAccess, requirePaid, reserveUsage, settleUsageTx } from "@/lib/pilot/access";
import { enqueueCrawl } from "./queue";

export async function requestCrawl(projectId: string, userId: string | null, scheduled = false) {
  const prepared = await transaction(async (tx) => {
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (scheduled) await requirePaid(tx, project.organizationId);
    else await currentAccess(tx, project.organizationId);
    const running = await tx.crawl.findFirst({ where: { projectId, status: { in: ["queued", "running"] } }, orderBy: { createdAt: "desc" } });
    if (running) return { crawl: running, created: false };
    const id = randomUUID();
    const reservation = await reserveUsage(tx, project.organizationId, "audit", `crawl:${id}`);
    const row = await tx.crawl.create({ data: { id, projectId, activeProjectId: projectId, reservationId: reservation.id,
      status: "queued", progress: JSON.stringify({ phase: "queued", message: "Queued…" }) } });
    await tx.auditLog.create({ data: { userId, action: scheduled ? "crawl.auto_start" : "crawl.start", entity: "crawl", entityId: id } });
    return { crawl: row, created: true };
  });
  const { crawl } = prepared;
  if (prepared.created) {
    try { await enqueueCrawl(crawl.id); }
    catch (error) {
      const failed = await transaction(async (tx) => {
        const updated = await tx.crawl.updateMany({ where: { id: crawl.id, status: "queued", leaseToken: null }, data: {
          activeProjectId: null, status: "failed", finishedAt: new Date(), error: "Could not queue the audit. Your allowance was returned; please try again.",
          progress: JSON.stringify({ phase: "failed", message: "Could not queue the audit" }) } });
        if (updated.count) await settleUsageTx(tx, crawl.reservationId, false);
        return updated.count > 0;
      });
      if (!failed) return prisma.crawl.findUniqueOrThrow({ where: { id: crawl.id } });
      throw error;
    }
  }
  return crawl;
}
