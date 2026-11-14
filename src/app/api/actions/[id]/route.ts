import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { accessibleAction } from "@/lib/pilot/actions";
import { ok, fail, apiError } from "@/lib/api";
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const { action } = await accessibleAction((await props.params).id, user.id);
    const body = await req.json().catch(() => ({}));
    const path = new URL(req.url).pathname;
    const op = path.endsWith("/approve") ? "approved" : path.endsWith("/reject") ? "rejected" : body.op;
    if (!["approved", "rejected"].includes(op)) return fail("Invalid review operation", 400);
    if (!["drafted", "awaiting_approval"].includes(action.status)) return action.status === op ? ok(action) : fail("This fix has already been reviewed.", 409);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.aIAction.updateMany({ where: { id: action.id, status: { in: ["drafted", "awaiting_approval"] } }, data: { status: op, reviewedBy: user.id, reviewedAt: new Date() } });
      if (changed.count) await tx.auditLog.create({ data: { userId: user.id, action: `action.${op}`, entity: "aiaction", entityId: action.id } });
      return tx.aIAction.findUniqueOrThrow({ where: { id: action.id } });
    });
    return ok(updated);
  } catch (error) { return apiError(error); }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const { action } = await accessibleAction((await props.params).id, user.id);
    const body = await req.json().catch(() => ({}));
    if (typeof body.proposedValue !== "string" || !body.proposedValue.trim() || body.proposedValue.length > 10000) return fail("Provide a non-empty proposed value of at most 10,000 characters.", 400);
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.aIAction.updateMany({ where: { id: action.id, status: { in: ["drafted", "awaiting_approval"] } }, data: { proposedValue: body.proposedValue.trim() } });
      if (!changed.count) return null;
      await tx.auditLog.create({ data: { userId: user.id, action: "action.edited", entity: "aiaction", entityId: action.id } });
      return tx.aIAction.findUniqueOrThrow({ where: { id: action.id } });
    });
    return result ? ok(result) : fail("Only fixes awaiting review can be edited.", 409);
  } catch (error) { return apiError(error); }
}
