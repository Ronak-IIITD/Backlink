import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "@/lib/audit/rules";

/** Shared orchestration types — planner → executor → verifier. Works with or without LLM. */

export interface BusinessContext {
  businessName?: string;
  targetCountry?: string;
  targetCity?: string;
}

export interface AgentUsage {
  tokens: number;
  cost: number;
  model: string;
  durationMs?: number;
  retries?: number;
}

export const NO_USAGE: AgentUsage = { tokens: 0, cost: 0, model: "deterministic" };

export interface PlanStep {
  id: string;
  agent: "strategist" | "fix_generator" | "content" | "monitor";
  goal: string;
  dependsOn: string[];
  bucket: "DO_THIS_NOW" | "DO_THIS_NEXT" | "WATCH";
  issueType?: string;
  priority: number;
}

export interface AgentPlan {
  steps: PlanStep[];
  createdBy: string; // "planner:deterministic" | "planner:llm"
}

/** Deterministic planner: turns sorted issues into an ordered task graph. LLM may reorder, never invent. */
export function buildPlan(pages: ParsedPage[], issues: RawIssue[]): AgentPlan {
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...issues].sort((a, b) => {
    if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
    return b.affectedUrls.length - a.affectedUrls.length;
  });
  const steps: PlanStep[] = sorted.slice(0, 12).map((iss, idx) => ({
    id: `step-${iss.type}`,
    agent: iss.type === "thin_content" ? "content" : "fix_generator",
    goal: iss.title,
    dependsOn: idx === 0 ? [] : [`step-${sorted[0].type}`],
    bucket: iss.severity === "critical" ? "DO_THIS_NOW" : iss.severity === "low" ? "WATCH" : "DO_THIS_NEXT",
    issueType: iss.type,
    priority: 99 - idx * 5,
  }));
  // strategist always first
  steps.unshift({
    id: "step-strategize",
    agent: "strategist",
    goal: `Rank ${issues.length} issue groups across ${pages.length} pages by impact`,
    dependsOn: [],
    bucket: "DO_THIS_NOW",
    priority: 100,
  });
  return { steps, createdBy: "planner:deterministic" };
}

/** Evidence guard: every URL an agent cites must exist in the crawl. */
export function filterToKnownUrls(urls: string[], pages: ParsedPage[]): string[] {
  const known = new Set<string>();
  for (const p of pages) {
    known.add(p.url);
    known.add(p.finalUrl);
  }
  return urls.filter((u) => known.has(u));
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
