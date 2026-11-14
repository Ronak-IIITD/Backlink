import { createHash } from "node:crypto";
import { isIP } from "node:net";
import IORedis from "ioredis";

let redis: IORedis | undefined;
const hits = new Map<string, { count: number; reset: number }>();
export async function rateLimit(key: string, limit = 60, windowMs = 60000) {
  if (process.env.REDIS_URL) {
    try {
      if (!redis) {
        redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000, commandTimeout: 3000, lazyConnect: true });
        redis.on("error", () => {});
      }
      const bucket = "rate:" + createHash("sha256").update(key).digest("hex");
      const count = Number(await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n", 1, bucket, windowMs));
      return { ok: count <= limit, remaining: Math.max(0, limit - count) };
    } catch { return { ok: false, remaining: 0 }; }
  }
  if (process.env.NODE_ENV === "production") return { ok: false, remaining: 0 };
  const now = Date.now();
  if (hits.size > 5000) for (const [id, value] of hits) if (value.reset < now) hits.delete(id);
  if (hits.size > 10000) return { ok: false, remaining: 0 };
  const current = hits.get(key);
  if (!current || current.reset <= now) { hits.set(key, { count: 1, reset: now + windowMs }); return { ok: true, remaining: limit - 1 }; }
  current.count++;
  return { ok: current.count <= limit, remaining: Math.max(0, limit - current.count) };
}
export function clientIp(req: Request) {
  // Trust only the closest ingress-proxy entry, never a client-supplied prefix.
  const host = (req.headers.get("x-forwarded-for") || "").split(",").at(-1)?.trim() || "";
  return isIP(host) ? host : "unknown";
}

export async function closeRateLimitConnection() { if (redis) { await redis.quit(); redis = undefined; } }
