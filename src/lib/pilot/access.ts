import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export class PilotError extends Error {
  constructor(public code: string, message: string, public status = 403, public resetsAt?: Date) { super(message); }
}
export type Transaction = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 }); }
    catch (error: any) {
      if (attempt >= 3 || !["P2034", "P1008", "P2028"].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}

export async function currentAccess(tx: Transaction, organizationId: string, now = new Date()) {
  const org = await tx.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new PilotError("NOT_FOUND", "Workspace not found", 404);
  if (org.suspended) throw new PilotError("ACCOUNT_SUSPENDED", "Your account is suspended. Contact support.");
  // Paid access takes precedence over the remaining free trial.
  const period = await tx.accessPeriod.findFirst({
    where: { organizationId, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
  if (!period) throw new PilotError("ACCESS_EXPIRED", "Contact support to activate or renew your pilot. Existing results remain available.");
  return period;
}
export async function requirePaid(tx: Transaction, organizationId: string) {
  const period = await currentAccess(tx, organizationId);
  if (period.kind !== "paid") throw new PilotError("PAID_ACCESS_REQUIRED", "Weekly monitoring is included with the paid pilot.");
  return period;
}
export async function reserveUsage(tx: Transaction, organizationId: string, kind: "audit" | "draft", key: string) {
  const existing = await tx.usageReservation.findUnique({ where: { key } });
  if (existing) {
    const period = await tx.accessPeriod.findUniqueOrThrow({ where: { id: existing.periodId } });
    if (period.organizationId !== organizationId) throw new PilotError("FORBIDDEN", "Invalid reservation");
    if (existing.status !== "released") return existing;
    throw new PilotError("RETRY_WITH_NEW_REQUEST", "Please start a new request.", 409);
  }
  const period = await currentAccess(tx, organizationId);
  const field = kind === "audit" ? "auditsUsed" : "draftsUsed";
  const limit = kind === "audit" ? period.auditLimit : period.draftLimit;
  const updated = await tx.accessPeriod.updateMany({
    where: { id: period.id, [field]: { lt: limit } }, data: { [field]: { increment: 1 } },
  });
  if (updated.count !== 1) throw new PilotError("USAGE_LIMIT_REACHED", `Your ${kind} allowance is used up. Contact support to renew.`, 429, period.endsAt);
  return tx.usageReservation.create({ data: { key, periodId: period.id, kind } });
}
export async function settleUsageTx(tx: Transaction, id: string | null | undefined, success: boolean) {
  if (!id) return;
  const row = await tx.usageReservation.findUnique({ where: { id } });
  if (!row || row.status !== "reserved") return;
  const changed = await tx.usageReservation.updateMany({ where: { id, status: "reserved" }, data: { status: success ? "committed" : "released" } });
  if (!success && changed.count) await tx.accessPeriod.update({ where: { id: row.periodId },
    data: { [row.kind === "audit" ? "auditsUsed" : "draftsUsed"]: { decrement: 1 } } });
}
export async function settleUsage(id: string | null | undefined, success: boolean) {
  if (id) await transaction((tx) => settleUsageTx(tx, id, success));
}
export function addCalendarMonth(value: Date) {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
