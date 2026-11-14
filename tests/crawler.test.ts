import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/lib/crawler/fetcher", () => ({ fetchPage: vi.fn() }));
vi.mock("@/lib/crawler/robots", () => ({ isAllowedByRobots: vi.fn() }));
vi.mock("@/lib/crawler/renderer", () => ({ renderPage: vi.fn() }));
import { fetchPage } from "@/lib/crawler/fetcher";
import { isAllowedByRobots } from "@/lib/crawler/robots";
import { renderPage } from "@/lib/crawler/renderer";
import { crawlSite } from "@/lib/crawler/crawler";
const raw = { url: "https://example.com/", finalUrl: "https://example.com/", statusCode: 200, contentType: "text/html", html: "<html><head></head><body><div id='root'></div><script>/* client-rendered content */</script></body></html>", sizeBytes: 200, loadMs: 50, depth: 0, redirectChain: [] };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(isAllowedByRobots).mockResolvedValue(true); vi.mocked(fetchPage).mockResolvedValue(raw); });
describe("bounded crawl pipeline", () => {
  it("audits rendered headings, titles, links and JSON-LD while retaining HTTP timing", async () => {
    vi.mocked(renderPage).mockResolvedValue({ html: '<html><head><title>Rendered title</title><script type="application/ld+json">{"@type":"Organization"}</script></head><body><h1>Rendered heading</h1><a href="/about">About</a></body></html>', finalUrl: raw.finalUrl, requestId: "render-1" });
    const result = await crawlSite(raw.url, { maxPages: 1, maxDepth: 1, rateLimitMs: 0, timeoutMs: 100, renderMode: "javascript", organizationId: "org" });
    expect(result.pages[0]).toMatchObject({ title: "Rendered title", h1: "Rendered heading", rendered: true, loadMs: 50, schemaTypes: ["Organization"] });
    expect(result.pages[0].links[0].href).toBe("https://example.com/about"); expect(result.coverage.limited).toBe(true);
  });
  it("does not accuse a site of missing content when the renderer fails", async () => {
    vi.mocked(renderPage).mockRejectedValue(new Error("Rendering unavailable"));
    const result = await crawlSite(raw.url, { maxPages: 1, maxDepth: 1, rateLimitMs: 0, timeoutMs: 100, renderMode: "javascript", organizationId: "org" });
    expect(result.coverage.audited).toBe(0); expect(result.coverage.partial).toBe(true); expect(result.pages[0].auditError).toContain("Rendering unavailable");
  });
  it("does not fetch robots-disallowed pages", async () => {
    vi.mocked(isAllowedByRobots).mockResolvedValue(false);
    const result = await crawlSite(raw.url, { maxPages: 30, maxDepth: 3, rateLimitMs: 0, timeoutMs: 100 });
    expect(fetchPage).not.toHaveBeenCalled(); expect(result.coverage.blocked).toBe(1); expect(result.coverage.audited).toBe(0);
  });
  it("does not crawl external domains or grow its frontier beyond its bound", async () => {
    vi.mocked(fetchPage).mockResolvedValue({ ...raw, html: `<html><body>${Array.from({ length: 200 }, (_, i) => `<a href='/page${i}'>Link</a>`).join("")}<a href='https://other.com'>Other</a></body></html>` });
    const result = await crawlSite(raw.url, { maxPages: 2, maxDepth: 3, rateLimitMs: 0, timeoutMs: 100 });
    expect(result.coverage.discovered).toBeLessThanOrEqual(6); expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetchPage).mock.calls.every(([url]) => new URL(url).hostname === "example.com")).toBe(true);
  });
});
