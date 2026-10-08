import psl from "psl";
import { fetchPage } from "./fetcher";
import { parseHtml } from "./parser";
import { isAllowedByRobots } from "./robots";
import type { CrawlOptions, ParsedPage } from "./types";
import { normalizeUrl } from "@/lib/url-validation";

function registrable(host: string): string {
  const p = psl.parse(host);
  if (typeof p === "object" && "domain" in p && p.domain) return p.domain as string;
  const parts = host.split(".");
  return parts.slice(-2).join(".");
}

function sameSite(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return registrable(ua.hostname) === registrable(ub.hostname);
  } catch {
    return false;
  }
}

function cleanLink(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // drop tracking params? keep simple: keep all but hash
    return u.toString();
  } catch {
    return null;
  }
}

export interface CrawlProgress {
  phase: string;
  message: string;
  found: number;
  crawled: number;
}

export async function crawlSite(
  startUrl: string,
  opts: CrawlOptions,
  onProgress?: (p: CrawlProgress) => void | Promise<void>
): Promise<{ pages: ParsedPage[]; errors: { url: string; error: string }[] }> {
  const start = normalizeUrl(startUrl);
  const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
  const seen = new Set<string>([start.split("#")[0]]);
  const pages: ParsedPage[] = [];
  const errors: { url: string; error: string }[] = [];

  const report = async (phase: string, message: string) => {
    if (onProgress) await onProgress({ phase, message, found: seen.size, crawled: pages.length });
  };

  await report("crawl", `Starting scan of ${start}…`);

  while (queue.length > 0 && pages.length < opts.maxPages) {
    const item = queue.shift()!;
    if (item.depth > opts.maxDepth) continue;
    try {
      if (!(await isAllowedByRobots(item.url))) {
        errors.push({ url: item.url, error: "Blocked by robots.txt" });
        continue;
      }
      await report("crawl", `Scanning ${item.url} (${pages.length + 1}/${opts.maxPages})…`);
      const raw = await fetchPage(item.url, opts.timeoutMs);
      raw.depth = item.depth;
      // only store HTML pages as full parsed; record non-200 as minimal page
      if (!raw.html && raw.statusCode !== 200) {
        pages.push({
          url: item.url, finalUrl: raw.finalUrl, statusCode: raw.statusCode,
          contentType: raw.contentType, title: null, metaDescription: null,
          canonical: null, h1: null, h1Count: 0, h2s: [], bodyText: "",
          wordCount: 0, links: [], images: [], altMissingCount: 0, og: {},
          schemaTypes: [], robotsDirectives: { noindex: true, nofollow: false },
          indexable: false, sizeBytes: raw.sizeBytes, loadMs: raw.loadMs, depth: item.depth,
        });
        continue;
      }
      if (!raw.html) continue;
      const parsed = parseHtml(raw);
      pages.push(parsed);

      // discover internal links
      if (item.depth < opts.maxDepth) {
        for (const l of parsed.links) {
          if (!l.internal) continue;
          const cleaned = cleanLink(l.href);
          if (!cleaned) continue;
          if (!sameSite(start, cleaned)) continue;
          // dedupe + avoid non-html assets
          if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js|zip|mp4|xml)(\?|$)/i.test(cleaned)) continue;
          if (seen.has(cleaned)) continue;
          seen.add(cleaned);
          if (seen.size > opts.maxPages * 3) continue; // bound frontier
          queue.push({ url: cleaned, depth: item.depth + 1 });
        }
      }
      if (opts.rateLimitMs > 0) await new Promise((r) => setTimeout(r, opts.rateLimitMs));
    } catch (e: any) {
      errors.push({ url: item.url, error: e?.message || "fetch error" });
      // record broken page stub so audit can flag 4xx/5xx + broken links
      pages.push({
        url: item.url, finalUrl: item.url, statusCode: 0,
        contentType: "", title: null, metaDescription: null,
        canonical: null, h1: null, h1Count: 0, h2s: [], bodyText: "",
        wordCount: 0, links: [], images: [], altMissingCount: 0, og: {},
        schemaTypes: [], robotsDirectives: { noindex: true, nofollow: false },
        indexable: false, sizeBytes: 0, loadMs: 0, depth: item.depth,
      });
    }
  }

  await report("crawl", `Found ${pages.length} pages. Analyzing…`);
  return { pages, errors };
}
