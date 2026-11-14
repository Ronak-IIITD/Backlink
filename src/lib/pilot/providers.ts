import { prisma } from "@/lib/db";
import { currentAccess, PilotError, transaction } from "./access";

export async function reserveProvider(provider: "ai" | "render", organizationId: string, units: number, tokenReservation = 0) {
  if (!Number.isSafeInteger(units) || units < 1) throw new Error("Invalid provider reservation");
  return transaction(async (tx) => {
    const period = await currentAccess(tx, organizationId);
    const month = new Date().toISOString().slice(0, 7);
    const key = provider === "ai" ? `ai:${organizationId}:${period.id}` : `render:${month}`;
    const limit = provider === "ai" ? Math.floor(Number(process.env.AI_MONTHLY_COST_CAP_USD || 5) * 1_000_000) : Number(process.env.RENDER_MONTHLY_CREDIT_CAP || 50000);
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid provider budget configuration");
    await tx.budgetBucket.upsert({ where: { id: key }, create: { id: key, organizationId: provider === "ai" ? organizationId : null, limit }, update: { limit } });
    const reserved = await tx.budgetBucket.updateMany({ where: { id: key, used: { lte: limit - units } }, data: { used: { increment: units } } });
    if (!reserved.count) throw new PilotError("PROVIDER_BUDGET_REACHED", provider === "ai" ? "AI budget reached; deterministic drafting remains available." : "Rendering capacity is temporarily unavailable. Please contact support.", 503);
    let tokenBucketId: string | undefined;
    if (provider === "ai" && tokenReservation > 0) {
      tokenBucketId = `tokens:${organizationId}:${new Date().toISOString().slice(0, 10)}`;
      const tokenLimit = Math.floor(Number(process.env.AI_DAILY_TOKEN_CAP || 500000));
      if (!Number.isSafeInteger(tokenLimit) || tokenLimit < 1) throw new Error("Invalid daily token limit");
      await tx.budgetBucket.upsert({ where: { id: tokenBucketId }, create: { id: tokenBucketId, organizationId, limit: tokenLimit }, update: { limit: tokenLimit } });
      const reserved = await tx.budgetBucket.updateMany({ where: { id: tokenBucketId, used: { lte: tokenLimit - tokenReservation } }, data: { used: { increment: tokenReservation } } });
      if (!reserved.count) throw new PilotError("PROVIDER_BUDGET_REACHED", "Daily AI token allowance reached. Using deterministic drafts.", 503);
    }
    return tx.providerCall.create({ data: { organizationId, provider, bucketId: key, reserved: units, tokenBucketId, tokenReservation } });
  });
}

/** Unknown upstream outcomes retain their full reservation instead of silently refunding cost. */
export async function settleProvider(id: string, charged?: number, tokens = 0, requestId?: string) {
  return transaction(async (tx) => {
    const call = await tx.providerCall.findUniqueOrThrow({ where: { id } });
    if (call.status !== "reserved") return;
    const amount = charged === undefined ? call.reserved : Math.max(0, Math.ceil(charged));
    const changed = await tx.providerCall.updateMany({ where: { id, status: "reserved" }, data: {
      charged: amount, tokens, requestId: requestId?.slice(0, 200), status: charged === undefined ? "unknown" : "settled", finishedAt: new Date(),
    } });
    if (changed.count) {
      await tx.budgetBucket.update({ where: { id: call.bucketId }, data: { used: { increment: amount - call.reserved } } });
      if (call.tokenBucketId) await tx.budgetBucket.update({ where: { id: call.tokenBucketId }, data: { used: { increment: (charged === undefined ? call.tokenReservation : tokens) - call.tokenReservation } } });
    }
  });
}
export async function providerUsage(organizationId: string) {
  return prisma.providerCall.aggregate({ where: { organizationId, provider: "ai", createdAt: { gte: new Date(Date.now() - 86400000) } }, _sum: { tokens: true } });
}
