import type { ParsedPage } from "@/lib/crawler/types";

export interface RawIssue {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  whatWrong: string;
  whyMatters: string;
  recommendation: string;
  impact: string;
  difficulty: "easy" | "medium" | "hard";
  affectedUrls: string[];
  source?: string;
}

/** Deterministic SEO rules — no LLM. Every check cites real crawled data. */
export function runSeoRules(pages: ParsedPage[]): RawIssue[] {
  const issues: RawIssue[] = [];
  const push = (i: RawIssue) => {
    if (i.affectedUrls.length) issues.push(i);
  };
  const htmlPages = pages.filter((p) => p.statusCode === 200);

  // 1. Broken pages (4xx/5xx or fetch fail status 0)
  const broken = pages.filter((p) => p.statusCode === 0 || (p.statusCode >= 400 && p.statusCode < 600));
  push({
    type: "broken_pages",
    severity: broken.length ? "critical" : "low",
    title: `${broken.length} broken page(s) found`,
    whatWrong: `These URLs return errors: ${broken.slice(0, 3).map((p) => `${p.url} (${p.statusCode || "fetch failed"})`).join(", ") || "none"}.`,
    whyMatters: "Visitors and Google hit dead ends. Broken pages waste crawl budget and lose customers.",
    recommendation: "Fix or redirect each broken URL to the closest live page. Remove links pointing to them.",
    impact: "high", difficulty: "medium", affectedUrls: broken.map((p) => p.url),
  });

  // 2. Missing titles
  const noTitle = htmlPages.filter((p) => !p.title);
  push({
    type: "missing_title", severity: "high",
    title: `${noTitle.length} page(s) missing a title tag`,
    whatWrong: "Title tag is empty or absent on these pages.",
    whyMatters: "The title is what shows in Google. Without it, Google invents one — usually badly — and clicks drop.",
    recommendation: "Write a unique 50–60 character title per page with the main topic near the front.",
    impact: "high", difficulty: "easy", affectedUrls: noTitle.map((p) => p.url),
  });

  // 3. Title too long/short
  const badTitleLen = htmlPages.filter((p) => p.title && (p.title.length < 30 || p.title.length > 60));
  push({
    type: "title_length", severity: "medium",
    title: `${badTitleLen.length} title(s) too short or too long`,
    whatWrong: "Titles should be 30–60 characters. Shorter wastes space; longer gets cut off in Google.",
    whyMatters: "Truncated titles get fewer clicks even if you rank.",
    recommendation: "Rewrite titles to 50–60 characters, front-loading the keyword and location if local.",
    impact: "medium", difficulty: "easy", affectedUrls: badTitleLen.map((p) => p.url),
  });

  // 4. Duplicate titles
  const titleMap = new Map<string, string[]>();
  for (const p of htmlPages) {
    if (!p.title) continue;
    const k = p.title.toLowerCase().trim();
    titleMap.set(k, [...(titleMap.get(k) || []), p.url]);
  }
  for (const [t, urls] of titleMap) {
    if (urls.length > 1) {
      push({
        type: "duplicate_title", severity: "high",
        title: `Duplicate title: “${t.slice(0, 60)}” on ${urls.length} pages`,
        whatWrong: `Same title on: ${urls.slice(0, 4).join(", ")}.`,
        whyMatters: "Google may be unsure which page should rank, so none of them rank well.",
        recommendation: "Make each title unique — include the page's specific service, topic, or location.",
        impact: "high", difficulty: "easy", affectedUrls: urls,
      });
    }
  }

  // 5. Missing meta descriptions
  const noMeta = htmlPages.filter((p) => !p.metaDescription);
  push({
    type: "missing_meta_description", severity: "high",
    title: `${noMeta.length} page(s) missing a meta description`,
    whatWrong: "No meta description found.",
    whyMatters: "The description is your free ad copy under your Google listing. Missing ones mean lower clicks.",
    recommendation: "Write 150–160 character descriptions with the benefit + keyword + location/call to action.",
    impact: "medium", difficulty: "easy", affectedUrls: noMeta.map((p) => p.url),
  });

  // 6. Duplicate meta
  const metaMap = new Map<string, string[]>();
  for (const p of htmlPages) {
    if (!p.metaDescription) continue;
    const k = p.metaDescription.toLowerCase().trim();
    metaMap.set(k, [...(metaMap.get(k) || []), p.url]);
  }
  for (const [m, urls] of metaMap) {
    if (urls.length > 1) {
      push({
        type: "duplicate_meta", severity: "medium",
        title: `Duplicate meta description on ${urls.length} pages`,
        whatWrong: `Identical description “${m.slice(0, 80)}…” appears on multiple pages.`,
        whyMatters: "Duplicate snippets confuse searchers and Google.",
        recommendation: "Write a unique description per page tied to that page's offer.",
        impact: "medium", difficulty: "easy", affectedUrls: urls,
      });
    }
  }

  // 7. Missing H1
  const noH1 = htmlPages.filter((p) => !p.h1);
  push({
    type: "missing_h1", severity: "high",
    title: `${noH1.length} page(s) missing an H1 heading`,
    whatWrong: "No H1 found in the page content.",
    whyMatters: "The H1 tells visitors and Google what the page is about in plain words.",
    recommendation: "Add one clear H1 per page matching the page's main topic/search intent.",
    impact: "medium", difficulty: "easy", affectedUrls: noH1.map((p) => p.url),
  });

  // 8. Multiple H1s
  const multiH1 = htmlPages.filter((p) => p.h1Count > 1);
  push({
    type: "multiple_h1", severity: "low",
    title: `${multiH1.length} page(s) with multiple H1s`,
    whatWrong: "More than one H1 tag found.",
    whyMatters: "Multiple H1s dilute the page's main topic signal.",
    recommendation: "Keep one H1; change extras to H2s.",
    impact: "low", difficulty: "easy", affectedUrls: multiH1.map((p) => p.url),
  });

  // 9. Thin content
  const thin = htmlPages.filter((p) => p.wordCount < 200 && p.indexable);
  push({
    type: "thin_content", severity: "high",
    title: `${thin.length} page(s) with very little useful content`,
    whatWrong: "Fewer than 200 words of readable text.",
    whyMatters: "Thin pages rarely rank — Google prefers pages that fully answer the query.",
    recommendation: "Expand with FAQs, examples, pricing/process details, and internal links. Aim 600+ words on money pages.",
    impact: "high", difficulty: "medium", affectedUrls: thin.map((p) => p.url),
  });

  // 10. Missing alt text
  const altPages = htmlPages.filter((p) => p.altMissingCount > 0);
  const totalAlt = altPages.reduce((s, p) => s + p.altMissingCount, 0);
  push({
    type: "missing_alt", severity: "medium",
    title: `${totalAlt} image(s) missing alt text on ${altPages.length} page(s)`,
    whatWrong: "Images without alt text can't be understood by screen readers or image search.",
    whyMatters: "You lose image-search traffic and hurt accessibility.",
    recommendation: "Add short descriptive alt text (what's in the image + context), not keyword stuffing.",
    impact: "medium", difficulty: "easy", affectedUrls: altPages.map((p) => p.url),
  });

  // 11. Noindex on indexable-looking pages
  const noindexed = pages.filter((p) => p.robotsDirectives.noindex && p.statusCode === 200);
  push({
    type: "noindex_issue", severity: noindexed.length > 2 ? "critical" : "medium",
    title: `${noindexed.length} live page(s) blocked by noindex`,
    whatWrong: "Pages return 200 but tell Google not to index them.",
    whyMatters: "Noindexed pages can never appear in Google, no matter how good they are.",
    recommendation: "If these should rank, remove the noindex meta/robots directive. If intentional (thank-you pages, admin), leave them.",
    impact: "high", difficulty: "easy", affectedUrls: noindexed.map((p) => p.url),
  });

  // 12. Canonical problems (canonical points elsewhere or missing on dupes)
  const canonMismatch = htmlPages.filter((p) => {
    if (!p.canonical) return false;
    try {
      const c = new URL(p.canonical, p.finalUrl).toString();
      return c.split("?")[0] !== p.finalUrl.split("?")[0];
    } catch {
      return true;
    }
  });
  push({
    type: "canonical_mismatch", severity: "medium",
    title: `${canonMismatch.length} page(s) with conflicting canonical`,
    whatWrong: "Canonical URL differs from the page URL — Google may index a different version.",
    whyMatters: "Wrong canonicals can make good pages invisible in search.",
    recommendation: "Point canonical at the preferred URL (usually itself) with absolute https URL.",
    impact: "medium", difficulty: "easy", affectedUrls: canonMismatch.map((p) => p.url),
  });

  // 13. Oversized pages
  const big = htmlPages.filter((p) => p.sizeBytes > 500_000);
  push({
    type: "oversized_page", severity: "low",
    title: `${big.length} oversized page(s) (>500KB HTML)`,
    whatWrong: "Very large HTML slows loading, especially on mobile.",
    whyMatters: "Slow pages rank worse and convert worse.",
    recommendation: "Compress images, defer scripts, and trim inline bloat.",
    impact: "medium", difficulty: "medium", affectedUrls: big.map((p) => p.url),
  });

  // 14. Slow pages (TTFB+download proxy)
  const slow = htmlPages.filter((p) => p.loadMs > 2500);
  push({
    type: "slow_page", severity: "medium",
    title: `${slow.length} slow-loading page(s)`,
    whatWrong: "Server response + download took over 2.5s during our scan.",
    whyMatters: "Speed is a ranking factor and directly affects bounce rate.",
    recommendation: "Enable caching/CDN, compress images, and reduce render-blocking scripts.",
    impact: "medium", difficulty: "medium", affectedUrls: slow.map((p) => p.url),
  });

  // 15. Missing OG tags
  const noOg = htmlPages.filter((p) => !p.og["og:title"] && !p.og["og:image"]);
  push({
    type: "missing_og", severity: "low",
    title: `${noOg.length} page(s) missing social preview tags`,
    whatWrong: "No Open Graph title/image — links shared on social look broken.",
    whyMatters: "Bad previews mean fewer clicks from social, less secondary traffic.",
    recommendation: "Add og:title, og:description, og:image (1200×630) per page.",
    impact: "low", difficulty: "easy", affectedUrls: noOg.map((p) => p.url),
  });

  // 16. No schema
  const noSchema = htmlPages.filter((p) => p.schemaTypes.length === 0 && p.wordCount > 200);
  push({
    type: "missing_schema", severity: "low",
    title: `${noSchema.length} content page(s) without structured data`,
    whatWrong: "No JSON-LD schema detected.",
    whyMatters: "Schema enables rich results (FAQs, reviews, business info) and higher clicks.",
    recommendation: "Add Organization + WebSite schema sitewide; Article/FAQ/LocalBusiness where relevant.",
    impact: "medium", difficulty: "medium", affectedUrls: noSchema.map((p) => p.url),
  });

  // 17. Orphan detection (pages with zero internal inlinks from crawled set)
  const inlinkCount = new Map<string, number>();
  for (const p of htmlPages) inlinkCount.set(p.finalUrl, 0);
  for (const p of htmlPages) {
    for (const l of p.links) {
      if (!l.internal) continue;
      if (inlinkCount.has(l.href)) inlinkCount.set(l.href, (inlinkCount.get(l.href) || 0) + 1);
    }
  }
  const orphans = htmlPages.filter((p) => (inlinkCount.get(p.finalUrl) || 0) === 0 && htmlPages.length > 1);
  // exclude homepage/start (first page) from orphan accusation
  const orphanFiltered = orphans.slice(1);
  push({
    type: "orphan_pages", severity: "medium",
    title: `${orphanFiltered.length} page(s) with no internal links pointing to them`,
    whatWrong: "These pages weren't linked from any other crawled page.",
    whyMatters: "Orphan pages are hard for Google and visitors to find — they rarely rank.",
    recommendation: "Link to them from relevant parent/category pages with descriptive anchor text.",
    impact: "medium", difficulty: "easy", affectedUrls: orphanFiltered.map((p) => p.url),
  });

  // 18. Poor internal linking (pages with <3 internal outlinks)
  const poorLink = htmlPages.filter((p) => p.links.filter((l) => l.internal).length < 3 && p.wordCount > 150);
  push({
    type: "poor_internal_linking", severity: "medium",
    title: `${poorLink.length} page(s) with very few internal links`,
    whatWrong: "Fewer than 3 internal links on content pages.",
    whyMatters: "Internal links spread authority and help Google discover content.",
    recommendation: "Add 3–8 contextual internal links per page to related services/posts.",
    impact: "medium", difficulty: "easy", affectedUrls: poorLink.map((p) => p.url),
  });

  // 19. HTTPS check
  const httpPages = pages.filter((p) => p.finalUrl.startsWith("http://"));
  push({
    type: "https_issue", severity: "critical",
    title: `${httpPages.length} page(s) served over insecure HTTP`,
    whatWrong: "Pages still load over http:// instead of https://.",
    whyMatters: "Browsers warn visitors; Google prefers secure pages.",
    recommendation: "Force HTTPS with 301 redirects and HSTS; fix mixed content.",
    impact: "high", difficulty: "medium", affectedUrls: httpPages.map((p) => p.url),
  });

  return issues.filter((i) => i.affectedUrls.length > 0);
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortIssues(issues: RawIssue[]): RawIssue[] {
  return [...issues].sort((a, b) => {
    if (SEV_ORDER[a.severity] !== SEV_ORDER[b.severity]) return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    return b.affectedUrls.length - a.affectedUrls.length;
  });
}
