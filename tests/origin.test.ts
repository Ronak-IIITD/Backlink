import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
afterEach(() => vi.unstubAllEnvs());
describe("browser request origin", () => {
  it("rejects sibling and external origins on mutations", () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    for (const origin of ["https://other.example.com", "https://attacker.com", "null"]) expect(middleware(new NextRequest("https://app.example.com/api/actions/id/approve", { method: "POST", headers: { origin } })).status).toBe(403);
  });
  it("accepts same-origin mutations and server-side cron requests without an Origin", () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(middleware(new NextRequest("https://app.example.com/api/test", { method: "POST", headers: { origin: "https://app.example.com" } })).status).toBe(200);
    expect(middleware(new NextRequest("https://app.example.com/api/cron/reports", { method: "POST" })).status).toBe(200);
  });
});
