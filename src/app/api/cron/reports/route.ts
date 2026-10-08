import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { isDue } from "@/lib/email";
import { sendScheduleNow } from "@/lib/email/send-schedule";

/**
 * Cron: POST /api/cron/reports with Authorization: Bearer $CRON_SECRET
 * Processes due weekly/monthly schedules. Wire to Vercel Cron / systemd timer.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not set.", 500);
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return fail("UNAUTHORIZED", 401);
  const rows = await prisma.reportSchedule.findMany({ take: 100, orderBy: { createdAt: "asc" } });
  const due = rows.filter((r) => isDue({ frequency: r.frequency, lastSentAt: r.lastSentAt }));
  const results: { id: string; email: string; sent: boolean; message: string }[] = [];
  for (const r of due.slice(0, 25)) {
    try {
      const res = await sendScheduleNow(r.id);
      results.push({ id: r.id, email: res.email, sent: res.sent, message: res.message });
    } catch (e: any) {
      results.push({ id: r.id, email: r.email, sent: false, message: String(e?.message || e) });
    }
  }
  return ok({ checked: rows.length, due: due.length, results });
}
