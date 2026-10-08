import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { sendTestAlert } from "@/lib/jobs/alerts";

/** Authed: send a sample alert to verify client email + branding. */
export async function POST(_: Request, { params }: { params: { id: string; nid: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const pref = await prisma.notificationPref.findUnique({ where: { id: params.nid } });
    if (!pref || pref.projectId !== params.id) return fail("NOT_FOUND", 404);
    const res = await sendTestAlert(pref.id);
    return ok({ sent: res.sent, mode: res.mode, message: res.message, email: pref.email });
  } catch (e: any) {
    const m = String(e?.message || "failed");
    if (m === "NOT_FOUND") return fail("NOT_FOUND", 404);
    return fail(m, 500);
  }
}
