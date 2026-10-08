import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "@/lib/audit/rules";

/**
 * Deterministic tools the agents use today (function calls) and an LLM can call tomorrow.
 * No network, no invention — only reads from the current crawl.
 */

export function getPageByUrl(pages: ParsedPage[], url: string): ParsedPage | null {
  return pages.find((p) => p.url === url || p.finalUrl === url) || null;
}

export function listIssuesBySeverity(issues: RawIssue[], severity: RawIssue["severity"]): RawIssue[] {
  return issues.filter((i) => i.severity === severity);
}

export function topPagesByWords(pages: ParsedPage[], n = 5): ParsedPage[] {
  return [...pages].sort((a, b) => b.wordCount - a.wordCount).slice(0, n);
}

export function thinPages(pages: ParsedPage[], threshold = 200): ParsedPage[] {
  return pages.filter((p) => p.statusCode === 200 && p.wordCount < threshold && p.indexable);
}

export function evidenceSummary(pages: ParsedPage[], issues: RawIssue[]): string {
  const live = pages.filter((p) => p.statusCode === 200).length;
  return `${pages.length} crawled, ${live} live, ${issues.length} issue groups. ` +
    `Sample: ${pages.slice(0, 2).map((p) => p.finalUrl).join(", ") || "none"}`;
}
