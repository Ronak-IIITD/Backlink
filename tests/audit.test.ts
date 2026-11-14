import { describe, it, expect } from "vitest";
import { parseHtml } from "@/lib/crawler/parser";
import { runSeoRules } from "@/lib/audit/rules";
import { calculateScore } from "@/lib/audit/scoring";
import { fixResolved } from "@/lib/jobs/verification";
import type { ParsedPage, RawPage } from "@/lib/crawler/types";
const raw = (html: string, extra: Partial<RawPage> = {}): RawPage => ({ url: "https://example.com/", finalUrl: "https://example.com/", statusCode: 200, contentType: "text/html", html, sizeBytes: 500, loadMs: 100, depth: 0, redirectChain: [], ...extra });
const page = (url: string, title: string): ParsedPage => parseHtml(raw(`<html><head><title>${title}</title></head><body><h1>Heading</h1><p>${"Content ".repeat(250)}</p></body></html>`, { url, finalUrl: url }));
describe("audit evidence", () => {
  it("extracts JSON-LD before removing scripts and handles graph schemas", () => {
    const parsed = parseHtml(raw('<html><head><script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":"WebPage"}]}</script></head><body><h1>Visible</h1><script>secret script text</script></body></html>'));
    expect(parsed.schemaTypes).toEqual(["Organization", "WebPage"]); expect(parsed.bodyText).not.toContain("secret script");
  });
  it("respects HTTP X-Robots-Tag and meta none", () => {
    expect(parseHtml(raw("<html><body>Content</body></html>", { xRobotsTag: "noindex, nofollow" })).indexable).toBe(false);
    expect(parseHtml(raw('<html><head><meta name="robots" content="none"></head><body>Content</body></html>')).robotsDirectives).toEqual({ noindex: true, nofollow: true });
  });
  it("counts words before truncating stored text", () => {
    const parsed = parseHtml(raw(`<html><body>${"longword ".repeat(5000)}</body></html>`));
    expect(parsed.wordCount).toBe(5000); expect(parsed.bodyText.length).toBeLessThanOrEqual(20000);
  });
  it("never scores empty, failed, non-HTML or unaudited rendered content as healthy", () => {
    expect(calculateScore([], []).overall).toBeNull();
    expect(calculateScore([{ ...page("https://example.com", "Title"), statusCode: 0 }], []).overall).toBeNull();
    expect(calculateScore([{ ...page("https://example.com", "Title"), auditError: "Renderer failed" }], []).overall).toBeNull();
  });
  it("aggregates independent duplicate-title groups instead of keeping only the last", () => {
    const pages = Array.from({ length: 10 }, (_, i) => page(`https://example.com/${i}`, `Unique title ${i}`));
    pages[0].title = pages[1].title = "First duplicated title";
    pages[2].title = pages[3].title = "Second duplicated title";
    const issues = runSeoRules(pages);
    const score = calculateScore(pages, issues);
    const collapsed = calculateScore(pages, issues.filter((issue) => issue.type !== "duplicate_title").concat(issues.filter((issue) => issue.type === "duplicate_title").slice(0, 1)));
    expect(score.categories.find((c) => c.key === "onpage")!.score).toBeLessThan(collapsed.categories.find((c) => c.key === "onpage")!.score);
  });
  it("verifies only an audited target whose original issue disappeared", () => {
    const payload = JSON.stringify({ issueType: "missing_title", urls: ["https://example.com/"] });
    const fixed = page("https://example.com/", "A clear new title for this specific page");
    expect(fixResolved(payload, [fixed], runSeoRules([fixed]))).toBe(true);
    expect(fixResolved(payload, [], [])).toBe(false);
    expect(fixResolved(payload, [{ ...fixed, auditError: "timeout" }], [])).toBe(false);
    const unchanged = { ...fixed, title: null };
    expect(fixResolved(payload, [unchanged], runSeoRules([unchanged]))).toBe(false);
    expect(fixResolved(JSON.stringify({ issueType: "missing_title", urls: [fixed.url, "https://example.com/other"] }), [fixed], [])).toBe(false);
  });
});
