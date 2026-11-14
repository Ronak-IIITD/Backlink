import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { accessibleAction } from "@/lib/pilot/actions";
import { ok, fail, apiError } from "@/lib/api";
export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const { action } = await accessibleAction((await props.params).id, user.id);
    if (["reported_updated", "verified"].includes(action.status)) return ok(action);
    if (action.status !== "approved") return fail("Approve the fix before reporting an update.", 409);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.aIAction.updateMany({ where: { id: action.id, status: "approved" }, data: { status: "reported_updated", reportedAt: new Date() } });
      if (changed.count) await tx.auditLog.create({ data: { userId: user.id, action: "action.reported_updated", entity: "aiaction", entityId: action.id } });
      return tx.aIAction.findUniqueOrThrow({ where: { id: action.id } });
    });
    return ok(updated);
  } catch (error) { return apiError(error); }
}
