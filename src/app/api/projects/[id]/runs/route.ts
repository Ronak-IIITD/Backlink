import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { checkBudget } from "@/lib/ai/budget";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const runs = await prisma.agentRun.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const totalCost = runs.reduce((s, r) => s + (r.costUsd || 0), 0);
    const totalTokens = runs.reduce((s, r) => s + (r.tokensUsed || 0), 0);
    const budget = await checkBudget(params.id).catch(() => null);
    return ok({ runs, totals: { costUsd: totalCost, tokens: totalTokens, count: runs.length }, budget, cms: { active: "manual", manual: { configured: true } } });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
