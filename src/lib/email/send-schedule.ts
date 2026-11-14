import { prisma } from "@/lib/db";
import { requirePaid } from "@/lib/pilot/access";
import { sendReportEmail } from "./index";
export async function sendScheduleNow(scheduleId: string) {
  const schedule = await prisma.reportSchedule.findUniqueOrThrow({ where: { id: scheduleId } });
  const project = await prisma.project.findUniqueOrThrow({ where: { id: schedule.projectId } });
  await requirePaid(prisma, project.organizationId);
  const owners = await prisma.membership.findMany({ where: { organizationId: project.organizationId, role: "owner" }, include: { user: { select: { email: true } } } });
  if (!owners.some((owner) => owner.user.email === schedule.email)) return { sent: false, mode: "skipped", message: "Report recipient is not the verified owner.", email: schedule.email };
  if (await prisma.crawl.findFirst({ where: { projectId: project.id, status: { in: ["queued", "running"] } } })) return { sent: false, mode: "skipped", message: "Waiting for the active audit to finish.", email: schedule.email };
  const completed = await prisma.crawl.findMany({ where: { projectId: project.id, status: "completed", scoreVersion: { gte: 2 } }, select: { id: true } });
  const report = await prisma.report.findFirst({ where: { projectId: project.id, crawlId: { in: completed.map((c) => c.id) } }, orderBy: { createdAt: "desc" } });
  const skip = (message: string) => ({ sent: false, mode: "skipped", message, email: schedule.email });
  if (!report) return skip("No completed current-version audit is available.");
  if (schedule.lastReportId === report.id || (schedule.lastSentAt && report.createdAt <= schedule.lastSentAt)) return skip("No new audit since the last report.");
  const key = `report:${schedule.id}:${report.id}`;
  const delivery = await prisma.emailDelivery.upsert({ where: { key }, create: { key, organizationId: project.organizationId, scheduleId, reportId: report.id }, update: {} });
  if (delivery.sentAt) return skip("This report has already been delivered.");
  if (Date.now() - delivery.createdAt.getTime() > 23 * 3600000) return skip("Delivery outcome needs operator review before retrying outside the provider idempotency window.");
  const summary = JSON.parse(report.summary);
  const result = await sendReportEmail({ to: schedule.email, projectName: project.name, websiteUrl: project.websiteUrl,
    score: summary.overall ?? null, markdown: report.markdown || "", whiteLabel: false, reportDate: report.createdAt,
    idempotencyKey: delivery.id });
  if (result.sent) await prisma.$transaction([
    prisma.emailDelivery.update({ where: { id: delivery.id }, data: { sentAt: new Date() } }),
    prisma.reportSchedule.update({ where: { id: schedule.id }, data: { lastSentAt: new Date(), lastReportId: report.id } }),
  ]);
  await prisma.auditLog.create({ data: { userId: null, action: result.sent ? "schedule.sent" : "schedule.send_attempt", entity: "project", entityId: project.id,
    meta: JSON.stringify({ mode: result.mode, deliveryId: delivery.id }) } });
  return { sent: result.sent, mode: result.mode, message: result.message, email: schedule.email };
}
