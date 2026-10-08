import { prisma } from "@/lib/db";

/** Per-project AI budget caps. Exceeded → deterministic fallback, never hard-fail. */

export function getCaps() {
  return {
    monthlyCostUsd: Number(process.env.AI_MONTHLY_COST_CAP_USD || 5),
    dailyTokens: Number(process.env.AI_DAILY_TOKEN_CAP || 500_000),
    perRunCostUsd: Number(process.env.AI_PER_RUN_COST_CAP_USD || 0.25),
  };
}

export interface BudgetCheck {
  allowed: boolean;
  reason: string | null;
  monthCost: number;
  dayTokens: number;
  caps: ReturnType<typeof getCaps>;
}

export async function checkBudget(projectId: string): Promise<BudgetCheck> {
  const caps = getCaps();
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const [monthRuns, dayRuns] = await Promise.all([
    prisma.agentRun.findMany({ where: { projectId, createdAt: { gte: monthAgo } }, select: { costUsd: true } }),
    prisma.agentRun.findMany({ where: { projectId, createdAt: { gte: dayAgo } }, select: { tokensUsed: true } }),
  ]).catch(() => [[], []] as any);
  const monthCost = monthRuns.reduce((s: number, r: any) => s + (r.costUsd || 0), 0);
  const dayTokens = dayRuns.reduce((s: number, r: any) => s + (r.tokensUsed || 0), 0);
  if (monthCost >= caps.monthlyCostUsd) {
    return { allowed: false, reason: `Monthly AI budget reached ($${monthCost.toFixed(2)}/$${caps.monthlyCostUsd}). Using $0 deterministic mode.`, monthCost, dayTokens, caps };
  }
  if (dayTokens >= caps.dailyTokens) {
    return { allowed: false, reason: `Daily token budget reached (${dayTokens}/${caps.dailyTokens}). Using $0 deterministic mode.`, monthCost, dayTokens, caps };
  }
  return { allowed: true, reason: null, monthCost, dayTokens, caps };
}
