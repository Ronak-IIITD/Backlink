import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const budget = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/pilot/providers", () => ({ reserveProvider: budget.reserve, settleProvider: budget.settle }));
vi.mock("@/lib/security/ssrf", () => ({ assertUrlSafe: vi.fn(async (url: string) => new URL(url)) }));
import { renderPage } from "@/lib/crawler/renderer";
beforeEach(() => { vi.stubEnv("SCRAPINGBEE_API_KEY", "test-provider-key"); budget.reserve.mockReset().mockResolvedValue({ id: "call" }); budget.settle.mockReset().mockResolvedValue(undefined); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("managed rendering adapter", () => {
  it("uses a fixed endpoint, bounded options and source metadata", async () => {
    const fetch = vi.fn(async () => new Response("<html><body>Rendered content</body></html>", { headers: { "spb-resolved-url": "https://example.com/", "spb-cost": "5", "spb-request-id": "req" } }));
    vi.stubGlobal("fetch", fetch);
    const result = await renderPage("https://example.com/", "org", new AbortController().signal, "crawl");
    const [endpoint, options] = fetch.mock.calls[0] as any;
    expect(endpoint.origin).toBe("https://app.scrapingbee.com"); expect(endpoint.searchParams.get("render_js")).toBe("true");
    expect(endpoint.searchParams.get("premium_proxy")).toBe("false"); expect(endpoint.searchParams.get("stealth_proxy")).toBe("false");
    expect(options.headers).toEqual({ Authorization: "Bearer test-provider-key" });
    expect(result.finalUrl).toBe("https://example.com/"); expect(budget.settle).toHaveBeenCalledWith("call", 5, 0, "req");
  });
  it("does not treat a provider error or exhausted credits as target-page evidence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Out of credits", { status: 401 })));
    await expect(renderPage("https://example.com/", "org", new AbortController().signal)).rejects.toThrow("unavailable (401)");
  });
  it("rejects a rendered page that redirects outside the website", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html></html>", { headers: { "spb-resolved-url": "https://other.com/" } })));
    await expect(renderPage("https://example.com/", "org", new AbortController().signal)).rejects.toThrow("left the website");
  });
  it("does not contact the provider after its shared budget rejects the reservation", async () => {
    budget.reserve.mockRejectedValue(new Error("Credit cap reached")); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(renderPage("https://example.com/", "org", new AbortController().signal)).rejects.toThrow("Credit cap"); expect(fetch).not.toHaveBeenCalled();
  });
});
