import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { requestCrawl } from "@/lib/jobs/submit";
export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const { id } = await props.params;
    await assertProjectAccess(user.id, id);
    return ok(await requestCrawl(id, user.id), 201);
  } catch (error) { return apiError(error); }
}
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const { id } = await props.params;
    await assertProjectAccess(user.id, id);
    return ok(await prisma.crawl.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 10 }));
  } catch (error) { return apiError(error); }
}
