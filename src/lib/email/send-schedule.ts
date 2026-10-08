import { prisma } from "@/lib/db";
import { sendReportEmail } from "./index";

export async function sendScheduleNow(scheduleId: string): Promise<{ sent: boolean; mode: string; message: string; email: string }> {
  const s = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
  if (!s) throw new Error("NOT_FOUND");
  const project = await prisma.project.findUnique({ where: { id: s.projectId } });
  if (!project) throw new Error("NOT_FOUND");
  const report = await prisma.report.findFirst({ where: { projectId: s.projectId }, orderBy: { createdAt: "desc" } });
  let score: number | null = null;
  if (report) {
    try { score = JSON.parse(report.summary || "{}").overall ?? null; } catch {}
  }
  const res = await sendReportEmail({
    to: s.email,
    projectName: project.name,
    websiteUrl: project.websiteUrl,
    score,
    markdown: report?.markdown || "No completed audit yet — run an audit first.",
    whiteLabel: s.whiteLabel,
    agencyName: s.agencyName,
    reportDate: report?.createdAt || new Date(),
  });
  if (res.sent) {
    await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastSentAt: new Date() } });
  }
  await prisma.auditLog.create({
    data: { userId: null, action: res.sent ? "schedule.sent" : "schedule.send_attempt", entity: "project", entityId: s.projectId, meta: JSON.stringify({ email: s.email, mode: res.mode }).slice(0, 1000) },
  });
  return { sent: res.sent, mode: res.mode, message: res.message, email: s.email };
}
