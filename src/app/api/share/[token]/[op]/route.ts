import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { hashToken } from "@/lib/share";

/** Public (no login): approve/reject a single awaiting action via magic link. */
export async function POST(req: Request, { params }: { params: { token: string; op: string } }) {
  const op = params.op === "approve" ? "approved" : params.op === "reject" ? "rejected" : null;
  if (!op) return fail("Use /approve or /reject.", 400);
  try {
    const link = await prisma.shareLink.findUnique({ where: { tokenHash: hashToken(params.token) } });
    if (!link || link.expiresAt < new Date()) return fail("Invalid or expired link.", 404);
    const body = await req.json().catch(() => ({}));
    const actionId = String(body.actionId || "");
    if (!actionId) return fail("Missing actionId.", 400);
    const action = await prisma.aIAction.findUnique({ where: { id: actionId } });
    if (!action) return fail("NOT_FOUND", 404);
    const crawl = await prisma.crawl.findUnique({ where: { id: action.crawlId } });
    if (!crawl || crawl.projectId !== link.projectId) return fail("FORBIDDEN", 403);
    if (action.status !== "awaiting_approval") {
      return fail(`Already ${action.status.replace(/_/g, " ")} — no change made.`, 409);
    }
    const updated = await prisma.aIAction.update({
      where: { id: action.id },
      data: { status: op, reviewedBy: `share:${link.id}`, reviewedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { userId: null, action: `action.${op}.via_share`, entity: "aiaction", entityId: action.id, meta: JSON.stringify({ label: link.label }) },
    });
    return ok({ id: updated.id, status: updated.status });
  } catch (e: any) {
    return fail(e.message || "failed", 500);
  }
}
