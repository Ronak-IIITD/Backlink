import * as cheerio from "cheerio";
import crypto from "node:crypto";
import type { ParsedPage, RawPage } from "./types";

export function parseHtml(raw: RawPage): ParsedPage {
  const $ = cheerio.load(raw.html);
  // remove scripts/styles/nav/footer noise for body text? keep main readable text
  $("script, style, noscript, svg").remove();
  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const h1All = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const h1 = h1All[0] || null;
  const h2s = $("h2")
    .map((_, el) => $(el).text().trim().slice(0, 200))
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const robotsMeta = (
    $('meta[name="robots"]').attr("content") ||
    $('meta[name="googlebot"]').attr("content") ||
    ""
  ).toLowerCase();
  const noindex = robotsMeta.includes("noindex");
  const nofollow = robotsMeta.includes("nofollow");
  const xRobots = ""; // captured at fetch layer if needed
  void xRobots;

  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 20000);
  const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  const links: ParsedPage["links"] = [];
  const baseHost = (() => {
    try {
      return new URL(raw.finalUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  $("a[href]").each((_, el) => {
    if (links.length >= 300) return;
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;
    let abs = href;
    try {
      abs = new URL(href, raw.finalUrl).toString();
    } catch {
      return;
    }
    let internal = false;
    try {
      internal = new URL(abs).hostname.toLowerCase() === baseHost;
    } catch {}
    links.push({ href: abs.split("#")[0], text: $(el).text().trim().slice(0, 120), internal });
  });

  const images: ParsedPage["images"] = [];
  let altMissing = 0;
  $("img").each((_, el) => {
    if (images.length >= 100) return;
    const src = ($(el).attr("src") || $(el).attr("data-src") || "").trim();
    if (!src) return;
    let abs = src;
    try {
      abs = new URL(src, raw.finalUrl).toString();
    } catch {}
    const alt = $(el).attr("alt");
    if (alt == null || alt.trim() === "") altMissing++;
    images.push({ src: abs.slice(0, 500), alt: alt ?? null });
  });

  const og: Record<string, string> = {};
  $('meta[property^="og:"], meta[name^="twitter:"]').each((_, el) => {
    const k = $(el).attr("property") || $(el).attr("name") || "";
    const v = $(el).attr("content") || "";
    if (k && v) og[k] = v.slice(0, 500);
  });

  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const txt = $(el).text();
      const json = JSON.parse(txt);
      const arr = Array.isArray(json) ? json : [json];
      for (const item of arr) {
        if (item && typeof item === "object" && (item as any)["@type"]) {
          const t = (item as any)["@type"];
          if (Array.isArray(t)) schemaTypes.push(...t.map(String).slice(0, 5));
          else schemaTypes.push(String(t));
        }
        if (item && (item as any)["@graph"]) {
          for (const g of (item as any)["@graph"]) {
            if (g?.["@type"]) schemaTypes.push(String(g["@type"]));
          }
        }
      }
    } catch {}
  });

  const indexable = !noindex && raw.statusCode === 200;

  return {
    url: raw.url,
    finalUrl: raw.finalUrl,
    statusCode: raw.statusCode,
    contentType: raw.contentType,
    title,
    metaDescription,
    canonical,
    h1,
    h1Count: h1All.length,
    h2s,
    bodyText,
    wordCount,
    links,
    images,
    altMissingCount: altMissing,
    og,
    schemaTypes: [...new Set(schemaTypes)].slice(0, 20),
    robotsDirectives: { noindex, nofollow },
    indexable,
    sizeBytes: raw.sizeBytes,
    loadMs: raw.loadMs,
    depth: raw.depth,
  };
}

export function hashBody(text: string): string {
  return crypto.createHash("sha256").update(text || "").digest("hex");
}
