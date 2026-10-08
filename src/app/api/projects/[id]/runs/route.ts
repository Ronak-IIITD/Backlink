import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { checkBudget } from "@/lib/ai/budget";
import { adapterStatus } from "@/lib/cms";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    const runs = await prisma.agentRun.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    const totalCost = runs.reduce((s, r) => s + (r.costUsd || 0), 0);
    const totalTokens = runs.reduce((s, r) => s + (r.tokensUsed || 0), 0);
    const budget = await checkBudget(params.id).catch(() => null);
    return ok({ runs, totals: { costUsd: totalCost, tokens: totalTokens, count: runs.length }, budget, cms: adapterStatus(project as any) });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
