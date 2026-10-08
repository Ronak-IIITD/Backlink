import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail, toStatus } from "@/lib/api";
import { sendScheduleNow } from "@/lib/email/send-schedule";

/** Authed: send a scheduled report immediately (tests the client email + white-label). */
export async function POST(_: Request, { params }: { params: { id: string; sid: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const s = await prisma.reportSchedule.findUnique({ where: { id: params.sid } });
    if (!s || s.projectId !== params.id) return fail("NOT_FOUND", 404);
    const res = await sendScheduleNow(s.id);
    return ok(res);
  } catch (e: any) {
    const m = String(e?.message || "failed");
    if (m === "NOT_FOUND") return fail("NOT_FOUND", 404);
    return fail(m, toStatus(e));
  }
}
