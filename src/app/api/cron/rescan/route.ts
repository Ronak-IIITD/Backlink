import { ok, fail } from "@/lib/api";
import { runDueRescans } from "@/lib/jobs/rescan";

/**
 * Cron: POST /api/cron/rescan with Authorization: Bearer $CRON_SECRET
 * Enqueues fresh crawls for per-site autoRescan schedules so emailed
 * reports always carry current scores. Run daily; each site decides
 * weekly/monthly cadence. Same-process enqueue (see queue.ts for prod note).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not set.", 500);
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) return fail("UNAUTHORIZED", 401);
  try {
    const results = await runDueRescans();
    const enqueued = results.filter((r) => r.action === "enqueued").length;
    return ok({ checked: results.length, enqueued, results });
  } catch (e: any) {
    return fail(e.message || "rescan failed", 500);
  }
}
