import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "@/lib/audit/rules";

/** Deterministic fallback — zero LLM cost. Specific to actual crawled data, never generic. */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function topicOf(page: ParsedPage): string {
  return page.h1 || page.title || page.finalUrl;
}

export function fallbackFixForIssue(issue: RawIssue, pages: ParsedPage[]): { kind: string; current: string | null; proposed: string; reason: string } | null {
  const firstUrl = issue.affectedUrls[0];
  const page = pages.find((p) => p.url === firstUrl || p.finalUrl === firstUrl) || pages[0];
  if (!page) return null;
  const host = hostOf(page.finalUrl);
  const topic = topicOf(page).slice(0, 80);

  switch (issue.type) {
    case "missing_meta_description": {
      const proposed = `${topic} — expert service in your area. See pricing, FAQs & book online at ${host}.`.slice(0, 158);
      return { kind: "meta_fix", current: null, proposed, reason: "Specific 150–160 char description using this page's real H1/title so it earns clicks." };
    }
    case "missing_title": {
      const proposed = `${topic} | ${host}`.slice(0, 60);
      return { kind: "title_fix", current: null, proposed, reason: "Creates the missing ranking + click signal from the page's actual topic." };
    }
    case "title_length": {
      const t = (page.title || topic).slice(0, 55);
      return { kind: "title_fix", current: page.title, proposed: t.length < 30 ? `${t} | ${host}`.slice(0, 60) : t, reason: "Trims/pads to 50–60 chars so Google shows the full title." };
    }
    case "duplicate_title": {
      const path = (() => { try { return new URL(page.finalUrl).pathname.replace(/\//g, " ").trim() || "Home"; } catch { return "Page"; } })();
      return { kind: "title_fix", current: page.title, proposed: `${page.title?.slice(0, 35)} — ${path}`.slice(0, 60), reason: "Differentiates this URL's title using its real path so Google can tell pages apart." };
    }
    case "missing_h1": {
      return { kind: "h1_fix", current: null, proposed: page.title || topic, reason: "Adds the absent H1 from the page's existing title/topic." };
    }
    case "missing_alt": {
      return { kind: "alt_fix", current: `${page.altMissingCount} image(s) without alt`, proposed: `Add descriptive alt e.g. “${topic} — photo 1” for each image`, reason: "Unlocks image search + accessibility with page-specific descriptions." };
    }
    case "missing_og": {
      return { kind: "og_fix", current: null, proposed: `<meta property="og:title" content="${(page.title || topic).slice(0, 70)}" /> + og:image 1200×630`, reason: "Fixes broken social previews for this exact page." };
    }
    case "thin_content": {
      return {
        kind: "faq_add", current: `${page.wordCount} words`,
        proposed: `Add FAQ: 1) What does ${topic} include? 2) How much does it cost? 3) How fast? 4) Why choose us in ${host}? + 300-word process/pricing section.`,
        reason: "Expands this thin page with query-shaped content tied to its real topic.",
      };
    }
    default:
      return null;
  }
}

export function fallbackPlainExplanation(issue: RawIssue): string {
  // Already plain in rules; fallback enriches with count + first URL specificity
  return `${issue.title}. Affects ${issue.affectedUrls.length} page(s), e.g. ${issue.affectedUrls[0]}. ${issue.whyMatters}`;
}

export function fallbackContentOpps(pages: ParsedPage[]): { topic: string; intent: string; targetKeyword: string; pageType: string; outline: string[]; suggestedTitle: string }[] {
  const opps: { topic: string; intent: string; targetKeyword: string; pageType: string; outline: string[]; suggestedTitle: string }[] = [];
  const thin = pages.filter((p) => p.wordCount < 400 && p.statusCode === 200).slice(0, 3);
  for (const p of thin) {
    const t = topicOf(p);
    opps.push({
      topic: `Expand: ${t}`,
      intent: "informational",
      targetKeyword: t.toLowerCase().slice(0, 60),
      pageType: "expand_existing",
      outline: [`What ${t} includes`, "Pricing & process", "FAQs", "How to book", "Related services"],
      suggestedTitle: `${t} — Pricing, Process & FAQs`,
    });
  }
  // cluster gap: if site has <5 pages, suggest pillar pages
  if (pages.length < 8) {
    opps.push({
      topic: "Services pillar + location pages",
      intent: "transactional",
      targetKeyword: "services + city",
      pageType: "new_page",
      outline: ["One page per core service", "Each with pricing, FAQs, proof, CTA, internal links"],
      suggestedTitle: "Our Services — What We Do & What It Costs",
    });
  }
  return opps.slice(0, 5);
}
