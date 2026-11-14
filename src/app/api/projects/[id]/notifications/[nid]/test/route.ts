import { rateLimit } from "@/lib/rate-limit";
import { requirePaid } from "@/lib/pilot/access";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { sendTestAlert } from "@/lib/jobs/alerts";

/** Authed: send a sample alert to verify client email + branding. */
export async function POST(_: Request, props: { params: Promise<{ id: string; nid: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    await requirePaid(prisma, project.organizationId);
    if (!(await rateLimit(`test-alert:${u.id}`, 3, 3600000)).ok) return fail("Please wait before sending another test alert.", 429);
    const pref = await prisma.notificationPref.findUnique({ where: { id: params.nid } });
    if (!pref || pref.projectId !== params.id) return fail("NOT_FOUND", 404);
    if (pref.email !== u.email) return fail("Use your verified account email.", 403);
    const res = await sendTestAlert(pref.id);
    return ok({ sent: res.sent, mode: res.mode, message: res.message, email: pref.email });
  } catch (e: any) {
    const m = String(e?.message || "failed");
    if (m === "NOT_FOUND") return fail("NOT_FOUND", 404);
    return fail(m, 500);
  }
}
