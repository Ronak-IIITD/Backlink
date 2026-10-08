import { describe, it, expect } from "vitest";
import { normalizeUrl } from "@/lib/url-validation";
import { isPrivateIp } from "@/lib/security/ssrf";
import { runSeoRules } from "@/lib/audit/rules";
import { calculateScore } from "@/lib/audit/scoring";
import type { ParsedPage } from "@/lib/crawler/types";

function page(over: Partial<ParsedPage> = {}): ParsedPage {
  return {
    url: "https://example.com/", finalUrl: "https://example.com/", statusCode: 200,
    contentType: "text/html", title: "Example Title That Is Long Enough Here", metaDescription: "A proper meta description that is between one-fifty and one-sixty characters long for testing purposes yes indeed.",
    canonical: null, h1: "Example", h1Count: 1, h2s: ["Sub"], bodyText: "word ".repeat(300), wordCount: 300,
    links: [], images: [], altMissingCount: 0, og: { "og:title": "x" }, schemaTypes: ["Organization"],
    robotsDirectives: { noindex: false, nofollow: false }, indexable: true, sizeBytes: 50000, loadMs: 400, depth: 0,
    ...over,
  } as ParsedPage;
}

describe("url validation", () => {
  it("adds https and validates", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
    expect(() => normalizeUrl("ftp://x.com")).toThrow();
    expect(() => normalizeUrl("not a url")).toThrow();
  });
});

describe("ssrf", () => {
  it("blocks private ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.5")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
});

describe("seo rules", () => {
  it("detects missing title + thin + alt", () => {
    const issues = runSeoRules([page({ title: null }), page({ url: "https://example.com/2", finalUrl: "https://example.com/2", wordCount: 50, bodyText: "short" })]);
    const types = issues.map((i) => i.type);
    expect(types).toContain("missing_title");
    expect(types).toContain("thin_content");
  });
  it("detects duplicates", () => {
    const issues = runSeoRules([page(), page({ url: "https://example.com/b", finalUrl: "https://example.com/b" })]);
    expect(issues.some((i) => i.type === "duplicate_title")).toBe(true);
  });
});

describe("scoring", () => {
  it("perfect-ish site scores high, broken site scores low", () => {
    const good = calculateScore([page()], []);
    expect(good.overall).toBeGreaterThan(85);
    const badPages = [page({ statusCode: 404, title: null, metaDescription: null, h1: null, wordCount: 10, indexable: false })];
    const badIssues = runSeoRules(badPages);
    const bad = calculateScore(badPages, badIssues);
    expect(bad.overall).toBeLessThan(good.overall);
  });
});
