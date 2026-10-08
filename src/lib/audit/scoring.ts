import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "./rules";

export interface CategoryScore {
  key: string;
  label: string;
  score: number; // 0-100
  explanation: string;
  topIssues: string[];
  nextActions: string[];
}

export interface HealthScore {
  overall: number;
  categories: CategoryScore[];
  counts: { critical: number; high: number; medium: number; low: number };
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Transparent scoring: start 100 per category, deduct per failed check. No invented data. */
export function calculateScore(pages: ParsedPage[], issues: RawIssue[]): HealthScore {
  const html = pages.filter((p) => p.statusCode === 200);
  const total = Math.max(html.length, 1);
  const byType = new Map(issues.map((i) => [i.type, i]));

  const count = (t: string) => byType.get(t)?.affectedUrls.length || 0;
  const has = (t: string) => (byType.get(t)?.affectedUrls.length || 0) > 0;

  // Technical: broken, https, slow, oversized, canonical, noindex misuse
  let technical = 100;
  technical -= Math.min(40, (count("broken_pages") / total) * 100);
  technical -= has("https_issue") ? 25 : 0;
  technical -= Math.min(20, (count("slow_page") / total) * 40);
  technical -= Math.min(15, (count("oversized_page") / total) * 30);
  technical -= Math.min(15, (count("canonical_mismatch") / total) * 30);

  // On-page: titles, metas, h1
  let onpage = 100;
  onpage -= Math.min(30, (count("missing_title") / total) * 100);
  onpage -= Math.min(20, (count("title_length") / total) * 50);
  onpage -= Math.min(20, (count("duplicate_title") / total) * 60);
  onpage -= Math.min(20, (count("missing_meta_description") / total) * 60);
  onpage -= Math.min(15, (count("missing_h1") / total) * 60);

  // Content: thin, duplicate meta, schema
  let content = 100;
  content -= Math.min(45, (count("thin_content") / total) * 100);
  content -= Math.min(20, (count("duplicate_meta") / total) * 50);
  content -= Math.min(15, (count("missing_schema") / total) * 30);

  // Linking: orphans, poor internal
  let linking = 100;
  linking -= Math.min(40, (count("orphan_pages") / total) * 100);
  linking -= Math.min(35, (count("poor_internal_linking") / total) * 70);

  // Indexability: noindex, broken, canonical
  let indexability = 100;
  indexability -= Math.min(60, (count("noindex_issue") / total) * 120);
  indexability -= Math.min(30, (count("broken_pages") / total) * 80);

  // Performance signals: slow, oversized, image weight proxy (alt pages often heavy)
  let performance = 100;
  performance -= Math.min(50, (count("slow_page") / total) * 100);
  performance -= Math.min(30, (count("oversized_page") / total) * 60);

  const categories: CategoryScore[] = [
    {
      key: "technical", label: "Technical SEO", score: clamp(technical),
      explanation: `Based on ${pages.length} crawled URLs: broken pages, HTTPS, speed, and canonical correctness.`,
      topIssues: issues.filter((i) => ["broken_pages", "https_issue", "slow_page", "canonical_mismatch"].includes(i.type)).slice(0, 3).map((i) => i.title),
      nextActions: count("broken_pages") ? ["Fix broken URLs first — they block everything else"] : ["Keep monitoring for new crawl errors"],
    },
    {
      key: "onpage", label: "On-Page SEO", score: clamp(onpage),
      explanation: `Titles, descriptions, and headings across ${total} live pages.`,
      topIssues: issues.filter((i) => i.type.includes("title") || i.type.includes("meta") || i.type.includes("h1")).slice(0, 3).map((i) => i.title),
      nextActions: ["Rewrite missing/duplicate titles and descriptions on top-traffic pages first"],
    },
    {
      key: "content", label: "Content", score: clamp(content),
      explanation: `Depth and uniqueness: ${count("thin_content")} thin page(s) detected.`,
      topIssues: issues.filter((i) => ["thin_content", "duplicate_meta", "missing_schema"].includes(i.type)).slice(0, 3).map((i) => i.title),
      nextActions: ["Expand thin money pages to 600+ words with FAQs"],
    },
    {
      key: "linking", label: "Internal Linking", score: clamp(linking),
      explanation: `${count("orphan_pages")} orphan(s), ${count("poor_internal_linking")} poorly linked page(s).`,
      topIssues: issues.filter((i) => i.type.includes("orphan") || i.type.includes("internal")).slice(0, 3).map((i) => i.title),
      nextActions: ["Add 3–8 contextual internal links per important page"],
    },
    {
      key: "indexability", label: "Indexability", score: clamp(indexability),
      explanation: `Whether Google can and should index your pages.`,
      topIssues: issues.filter((i) => ["noindex_issue", "broken_pages", "canonical_mismatch"].includes(i.type)).slice(0, 3).map((i) => i.title),
      nextActions: count("noindex_issue") ? ["Review noindex directives immediately"] : ["No blocking issues detected"],
    },
    {
      key: "performance", label: "Performance Signals", score: clamp(performance),
      explanation: `Server speed and page weight as measured during crawl (not lab Lighthouse).`,
      topIssues: issues.filter((i) => ["slow_page", "oversized_page"].includes(i.type)).slice(0, 3).map((i) => i.title),
      nextActions: ["Compress images + enable caching/CDN"],
    },
  ];

  const overall = clamp(
    technical * 0.25 + onpage * 0.25 + content * 0.15 + linking * 0.15 + indexability * 0.12 + performance * 0.08
  );

  return {
    overall,
    categories,
    counts: {
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length,
    },
  };
}
