import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";

async function handle(req: Request, ctx: { params: { id: string } }, op: "approved" | "rejected") {
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", 401);
  const action = await prisma.aIAction.findUnique({ where: { id: ctx.params.id } });
  if (!action) return fail("NOT_FOUND", 404);
  const updated = await prisma.aIAction.update({
    where: { id: action.id },
    data: { status: op, reviewedBy: u.id, reviewedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: `action.${op}`, entity: "aiaction", entityId: action.id } });
  void req;
  return ok(updated);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const isApprove = new URL(req.url).pathname.endsWith("/approve");
  return handle(req, ctx, isApprove ? "approved" : "rejected");
}
