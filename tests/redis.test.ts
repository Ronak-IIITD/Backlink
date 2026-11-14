import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { rateLimit, closeRateLimitConnection } from "@/lib/rate-limit";
describe.skipIf(!process.env.TEST_REDIS_URL)("shared Redis rate limits", () => {
  beforeAll(() => vi.stubEnv("REDIS_URL", process.env.TEST_REDIS_URL!));
  afterAll(async () => { await closeRateLimitConnection(); vi.unstubAllEnvs(); });
  it("enforces one limit across simultaneous requests", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(key, 5, 60000)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
  it("expires the window instead of permanently locking a customer out", async () => {
    const key = `test:${randomUUID()}`;
    expect((await rateLimit(key, 1, 100)).ok).toBe(true); expect((await rateLimit(key, 1, 100)).ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 150)); expect((await rateLimit(key, 1, 100)).ok).toBe(true);
  });
});
