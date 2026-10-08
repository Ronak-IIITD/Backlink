import crypto from "node:crypto";

export function newShareToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function expiryFromDays(days: number): Date {
  const d = Math.max(1, Math.min(90, Math.floor(days) || 30));
  return new Date(Date.now() + d * 24 * 3600 * 1000);
}
