import { prisma } from "@/lib/db";
import { assertProjectAccess } from "@/lib/auth";
import { PilotError } from "./access";
export async function accessibleAction(id: string, userId: string) {
  const action = await prisma.aIAction.findUnique({ where: { id } });
  if (!action) throw new PilotError("NOT_FOUND", "NOT_FOUND", 404);
  const crawl = await prisma.crawl.findUnique({ where: { id: action.crawlId } });
  if (!crawl) throw new PilotError("NOT_FOUND", "NOT_FOUND", 404);
  const project = await assertProjectAccess(userId, crawl.projectId);
  return { action, project };
}
