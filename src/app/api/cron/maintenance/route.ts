import { ok, fail, apiError } from "@/lib/api";
import { recoverAbandonedWork, purgeExpiredAccounts } from "@/lib/pilot/maintenance";
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("UNAUTHORIZED", 401);
  try { return ok({ ...await recoverAbandonedWork(), deleted: await purgeExpiredAccounts() }); }
  catch (error) { return apiError(error); }
}
