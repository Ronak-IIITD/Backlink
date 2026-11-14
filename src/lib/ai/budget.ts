import { prisma } from "@/lib/db";
import { currentAccess } from "@/lib/pilot/access";
export function getCaps() {
  return { monthlyCostUsd: Number(process.env.AI_MONTHLY_COST_CAP_USD || 5), dailyTokens: Number(process.env.AI_DAILY_TOKEN_CAP || 500000), perRunCostUsd: Number(process.env.AI_PER_RUN_COST_CAP_USD || 0.25) };
}
export async function checkBudget(projectId: string) {
  const caps = getCaps();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  try {
    const period = await currentAccess(prisma, project.organizationId);
    const bucket = await prisma.budgetBucket.findUnique({ where: { id: `ai:${project.organizationId}:${period.id}` } });
    const daily = await prisma.providerCall.aggregate({ where: { organizationId: project.organizationId, provider: "ai", createdAt: { gte: new Date(Date.now() - 86400000) } }, _sum: { tokens: true } });
    const monthCost = (bucket?.used || 0) / 1_000_000, dayTokens = daily._sum.tokens || 0;
    const allowed = monthCost < caps.monthlyCostUsd && dayTokens < caps.dailyTokens;
    return { allowed, reason: allowed ? null : "AI budget reached. Using deterministic drafts.", monthCost, dayTokens, caps };
  } catch { return { allowed: false, reason: "Paid or trial access is unavailable.", monthCost: 0, dayTokens: 0, caps }; }
}
