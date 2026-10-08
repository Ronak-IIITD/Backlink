/** Simple in-memory rate limiter (per-IP). For prod, swap with Redis/Upstash. */
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60_000): { ok: boolean; remaining: number } {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now > cur.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  cur.count++;
  if (cur.count > limit) return { ok: false, remaining: 0 };
  return { ok: true, remaining: limit - cur.count };
}

export function clientIp(req: Request): string {
  const h = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return h || "local";
}
