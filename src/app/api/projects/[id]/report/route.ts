import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const report = await prisma.report.findFirst({ where: { projectId: params.id }, orderBy: { createdAt: "desc" } });
    if (!report) return ok({ report: null });
    return ok({ report });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
