import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", 401);
  const action = await prisma.aIAction.findUnique({ where: { id: params.id } });
  if (!action) return fail("NOT_FOUND", 404);
  const updated = await prisma.aIAction.update({
    where: { id: action.id },
    data: { status: "rejected", reviewedBy: u.id, reviewedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "action.rejected", entity: "aiaction", entityId: action.id } });
  return ok(updated);
}
