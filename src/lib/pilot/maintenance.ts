import { prisma } from "@/lib/db";
import { settleUsage } from "./access";
export async function recoverAbandonedWork(now = new Date()) {
  const expired = await prisma.crawl.findMany({ where: { status: { in: ["queued", "running"] },
    OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null, createdAt: { lt: new Date(now.getTime() - 30 * 60000) } }] }, take: 50 });
  let recovered = 0;
  for (const crawl of expired) {
    // Recover conservatively: return the allowance and let the customer start a new audit.
    const changed = await prisma.crawl.updateMany({ where: { id: crawl.id, status: { in: ["queued", "running"] }, leaseToken: crawl.leaseToken,
      OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null, createdAt: { lt: new Date(now.getTime() - 30 * 60000) } }] }, data: { status: "failed", activeProjectId: null,
      leaseToken: null, leaseExpiresAt: null, finishedAt: now, error: "The worker stopped before this audit finished. Your allowance has been returned; retry from your site." } });
    if (changed.count) { await settleUsage(crawl.reservationId, false); recovered++; }
  }
  const drafts = await prisma.aIAction.findMany({ where: { status: "generating", createdAt: { lt: new Date(now.getTime() - 10 * 60000) } }, take: 50 });
  for (const draft of drafts) {
    const changed = await prisma.aIAction.updateMany({ where: { id: draft.id, status: "generating" }, data: { status: "failed", activeIssueId: null } });
    if (changed.count) await settleUsage(draft.reservationId, false);
  }
  await prisma.invitation.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * 86400000) } } });
  return { recovered, expiredDrafts: drafts.length };
}

export async function deleteOrganization(organizationId: string, reason: string) {
  const members = await prisma.membership.findMany({ where: { organizationId }, select: { userId: true } });
  const projects = await prisma.project.findMany({ where: { organizationId }, select: { id: true } });
  const crawls = await prisma.crawl.findMany({ where: { projectId: { in: projects.map((p) => p.id) } }, select: { id: true } });
  // Do not remove an organization while an active worker could still write its results.
  if (await prisma.crawl.count({ where: { projectId: { in: projects.map((p) => p.id) }, activeProjectId: { not: null } } })) throw new Error("Wait for active audits to finish before deleting this workspace.");
  await prisma.$transaction(async (tx) => {
    await tx.aIAction.deleteMany({ where: { crawlId: { in: crawls.map((c) => c.id) } } });
    await tx.providerCall.deleteMany({ where: { organizationId } });
    await tx.budgetBucket.deleteMany({ where: { organizationId } });
    await tx.emailDelivery.deleteMany({ where: { organizationId } });
    await tx.organization.delete({ where: { id: organizationId } });
    for (const member of members) {
      if (await tx.membership.count({ where: { userId: member.userId } })) continue;
      const user = await tx.user.findUnique({ where: { id: member.userId } });
      if (user) await tx.invitation.deleteMany({ where: { email: user.email } });
      await tx.session.deleteMany({ where: { userId: member.userId } });
      await tx.auditLog.deleteMany({ where: { userId: member.userId } });
      await tx.user.delete({ where: { id: member.userId } });
    }
    await tx.auditLog.create({ data: { userId: null, action: "organization.deleted", entity: "organization", entityId: organizationId, meta: JSON.stringify({ reason }) } });
  });
}
export async function purgeExpiredAccounts(now = new Date()) {
  const cutoff = new Date(now.getTime() - 90 * 86400000);
  const organizations = await prisma.organization.findMany({ where: { accessPeriods: { some: {}, none: { endsAt: { gt: cutoff } } } }, select: { id: true }, take: 25 });
  let deleted = 0;
  for (const org of organizations) {
    try { await deleteOrganization(org.id, "90-day retention expired"); deleted++; } catch { /* Retry on the next maintenance run. */ }
  }
  return deleted;
}
