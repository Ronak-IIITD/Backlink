import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const crawls = await prisma.crawl.findMany({ where: { projectId: params.id }, select: { id: true } });
    const ids = crawls.map((c) => c.id);
    const actions = await prisma.aIAction.findMany({ where: { crawlId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 100 });
    return ok(actions);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
