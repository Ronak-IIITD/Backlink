import { fetchPage } from "./fetcher";
import { parseHtml } from "./parser";
import { isAllowedByRobots } from "./robots";
import { renderPage } from "./renderer";
import { sameSite } from "./scope";
import type { CrawlOptions, ParsedPage } from "./types";
import { normalizeUrl } from "@/lib/url-validation";

export interface CrawlProgress { phase: string; message: string; found: number; crawled: number }
export interface CrawlCoverage {
  attempted: number; audited: number; discovered: number; blocked: number;
  failed: number; limited: boolean; partial: boolean; mode: "html" | "javascript";
}
function stub(url: string, depth: number, error: string, statusCode = 0): ParsedPage {
  return { url, finalUrl: url, statusCode, contentType: "", title: null, metaDescription: null,
    canonical: null, h1: null, h1Count: 0, h2s: [], bodyText: "", wordCount: 0, links: [], images: [],
    altMissingCount: 0, og: {}, schemaTypes: [], robotsDirectives: { noindex: false, nofollow: false },
    indexable: false, sizeBytes: 0, loadMs: 0, depth, auditError: error };
}
export async function crawlSite(startUrl: string, opts: CrawlOptions, onProgress?: (p: CrawlProgress) => void | Promise<void>) {
  const start = normalizeUrl(startUrl);
  const maxPages = Math.min(30, Math.max(1, opts.maxPages));
  const queue = [{ url: start, depth: 0 }];
  const seen = new Set<string>([start]);
  const pages: ParsedPage[] = [], errors: { url: string; error: string }[] = [];
  const mode = opts.renderMode || "html";
  const deadline = AbortSignal.timeout(Math.max(1, Math.min(opts.deadlineMs ?? 900000, 900000)));
  let attempted = 0, blocked = 0;
  const report = async (message: string) => onProgress?.({ phase: "crawl", message, found: seen.size, crawled: pages.length });
  await report(`Starting scan of ${start}…`);
  while (queue.length && attempted < maxPages && !deadline.aborted) {
    const { url, depth } = queue.shift()!;
    attempted++;
    try {
      if (!(await isAllowedByRobots(url, undefined, deadline))) { blocked++; errors.push({ url, error: "Blocked by robots.txt" }); continue; }
      await report(`Scanning ${url} (${attempted}/${maxPages})…`);
      const raw = await fetchPage(url, opts.timeoutMs, 0, deadline);
      raw.depth = depth;
      if (!sameSite(start, raw.finalUrl)) throw new Error("Redirect left the website's domain");
      if (raw.finalUrl !== url && !(await isAllowedByRobots(raw.finalUrl, undefined, deadline))) {
        blocked++; errors.push({ url, error: "Redirect destination blocked by robots.txt" }); continue;
      }
      if (!raw.html) {
        if (raw.statusCode >= 400) pages.push(stub(url, depth, `HTTP ${raw.statusCode}`, raw.statusCode));
        continue;
      }
      if (mode === "javascript" && raw.statusCode === 200) {
        try {
          if (!opts.organizationId) throw new Error("Rendering requires a workspace");
          const rendered = await renderPage(raw.finalUrl, opts.organizationId, deadline, opts.crawlId);
          if (!(await isAllowedByRobots(rendered.finalUrl, undefined, deadline))) throw new Error("Rendered destination blocked by robots.txt");
          raw.html = rendered.html; raw.finalUrl = rendered.finalUrl; raw.rendered = true;
        } catch (error) {
          const message = (error as Error).message;
          errors.push({ url, error: message }); pages.push(stub(url, depth, message, raw.statusCode)); continue;
        }
      }
      const parsed = parseHtml(raw);
      parsed.rendered = !!raw.rendered;
      pages.push(parsed);
      if (depth < opts.maxDepth) {
        for (const link of parsed.links) {
          try {
            const next = new URL(link.href);
            next.hash = "";
            if (!["http:", "https:"].includes(next.protocol) || !sameSite(start, next.href)) continue;
            if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js|zip|mp4|xml)(\?|$)/i.test(next.href)) continue;
            if (seen.has(next.href) || seen.size >= maxPages * 3) continue;
            seen.add(next.href); queue.push({ url: next.href, depth: depth + 1 });
          } catch { /* Ignore malformed discovered links. */ }
        }
      }
    } catch (error) {
      const message = (error as Error).message || "Request failed";
      errors.push({ url, error: message }); pages.push(stub(url, depth, message));
    }
    if (opts.rateLimitMs > 0 && !deadline.aborted) await new Promise((resolve) => setTimeout(resolve, Math.min(opts.rateLimitMs, 1000)));
  }
  const audited = pages.filter((p) => p.statusCode === 200 && !p.auditError && /html/i.test(p.contentType)).length;
  const coverage: CrawlCoverage = { attempted, audited, discovered: seen.size, blocked,
    failed: errors.length - blocked, limited: queue.length > 0 || deadline.aborted,
    partial: errors.length > 0 || queue.length > 0 || deadline.aborted, mode };
  await report(`Audited ${audited} pages${coverage.partial ? " with incomplete coverage" : ""}. Analyzing…`);
  return { pages, errors, coverage };
}
