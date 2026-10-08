import type { ParsedPage } from "@/lib/crawler/types";
import type { RawIssue } from "@/lib/audit/rules";
import { callLLM, callLLMValidated } from "./provider";
import { fallbackContentOpps, fallbackFixForIssue } from "./fallback";
import { StrategyListSchema, FixSchema } from "./schemas";
import { buildPlan, filterToKnownUrls, clamp, type AgentPlan, type BusinessContext } from "./types";
import { getPageByUrl } from "./tools";
import { checkBudget } from "./budget";

export type StepFn = (msg: string) => Promise<void> | void;

/**
 * Best-in-class orchestration for SEO work: planner → executor → verifier.
 * - Deterministic code does detection + planning + verification (always runs, $0).
 * - LLM does interpretation + drafting (enhances, never invents).
 * - Every URL cited must exist in the crawl. Every output is zod-validated.
 */

const BASE_RULES = `You are an SEO employee for a small business. Use ONLY the provided crawl data. Never invent pages, rankings, backlinks, or traffic. Be specific, cite real URLs. Plain language, no jargon. Never promise rankings. Output valid JSON only.`;

export interface StrategyRec {
  category: string;
  priority: number;
  bucket: "DO_THIS_NOW" | "DO_THIS_NEXT" | "WATCH" | "NO_ACTION";
  whatWrong: string;
  whyMatters: string;
  whatToChange: string;
  canAutomate: boolean;
  needsApproval: string | null;
  relatedIssueType: string | null;
  affectedUrls: string[];
  confidence: number;
}

function categoryFor(type: string): string {
  if (type.includes("title") || type.includes("meta") || type.includes("h1")) return "onpage";
  if (type.includes("orphan") || type.includes("internal")) return "linking";
  if (type.includes("thin") || type.includes("schema") || type.includes("alt")) return "content";
  if (type.includes("slow") || type.includes("oversized")) return "performance";
  if (type.includes("noindex") || type.includes("canonical") || type.includes("broken") || type.includes("https")) return "indexability";
  return "technical";
}

const AUTOMATABLE = new Set([
  "missing_meta_description", "missing_title", "title_length",
  "duplicate_title", "missing_h1", "missing_alt", "missing_og", "thin_content",
]);

const NEEDS_APPROVAL = new Set([
  "missing_meta_description", "missing_title", "title_length", "duplicate_title", "missing_h1",
]);

function deterministicRecs(sorted: RawIssue[]): StrategyRec[] {
  const sevScore: Record<string, number> = { critical: 95, high: 78, medium: 55, low: 30 };
  return sorted.slice(0, 12).map((i) => ({
    category: categoryFor(i.type),
    priority: Math.min(99, (sevScore[i.severity] ?? 50) + Math.min(10, i.affectedUrls.length)),
    bucket: (i.severity === "critical" ? "DO_THIS_NOW" : i.severity === "low" ? "WATCH" : "DO_THIS_NEXT") as StrategyRec["bucket"],
    whatWrong: i.title,
    whyMatters: i.whyMatters,
    whatToChange: i.recommendation,
    canAutomate: AUTOMATABLE.has(i.type),
    needsApproval: NEEDS_APPROVAL.has(i.type)
      ? "Approve the exact replacement text before we apply it to your site/CMS." : null,
    relatedIssueType: i.type,
    affectedUrls: i.affectedUrls.slice(0, 10),
    confidence: 0.92,
  }));
}

/** Verifier: drop invented URLs, clamp ranges, drop low-quality recs. */
function verifyRecs(recs: StrategyRec[], pages: ParsedPage[], issues: RawIssue[]): StrategyRec[] {
  const validTypes = new Set(issues.map((i) => i.type));
  const out: StrategyRec[] = [];
  for (const r of recs) {
    if (!r.whatWrong || !r.whatToChange) continue;
    const urls = filterToKnownUrls(r.affectedUrls || [], pages).slice(0, 10);
    // keep rec even with 0 urls if it maps to a real issue type (strategic rec), else drop
    if (!urls.length && r.relatedIssueType && !validTypes.has(r.relatedIssueType)) continue;
    out.push({
      ...r,
      category: r.category || categoryFor(r.relatedIssueType || ""),
      priority: clamp(Math.round(r.priority), 0, 99),
      confidence: clamp(r.confidence ?? 0.8, 0, 1),
      affectedUrls: urls.length ? urls : (issues.find((i) => i.type === r.relatedIssueType)?.affectedUrls.slice(0, 10) || []),
      canAutomate: typeof r.canAutomate === "boolean" ? r.canAutomate : (r.relatedIssueType ? AUTOMATABLE.has(r.relatedIssueType) : false),
    });
  }
  return out.slice(0, 15);
}

export async function strategistAgent(
  pages: ParsedPage[],
  issues: RawIssue[],
  businessContext: BusinessContext,
  opts?: { onStep?: StepFn; projectId?: string }
): Promise<{ recs: StrategyRec[]; plan: AgentPlan; usage: { tokens: number; cost: number; model: string; durationMs: number } }> {
  const started = Date.now();
  const emit = async (m: string) => { try { await opts?.onStep?.(m); } catch {} };
  await emit(`Planned ${issues.length} issue groups into ranked steps`);
  const plan = buildPlan(pages, issues);
  const sorted = [...issues].sort((a, b) => {
    const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return o[a.severity] - o[b.severity];
  });
  const slim = sorted.slice(0, 12).map((i) => ({
    type: i.type, severity: i.severity, title: i.title,
    count: i.affectedUrls.length, sample: i.affectedUrls.slice(0, 3),
    recommendation: i.recommendation,
  }));
  const pageSlim = pages.slice(0, 8).map((p) => ({
    url: p.finalUrl, title: p.title, h1: p.h1, words: p.wordCount, status: p.statusCode,
  }));

  const user = JSON.stringify({ businessContext, plan: plan.steps.map((s) => ({ id: s.id, goal: s.goal, bucket: s.bucket })), pageCount: pages.length, pages: pageSlim, issues: slim });
  // Budget gate: if over cap, skip LLM entirely ($0 path)
  let budgetBlocked: string | null = null;
  if (opts?.projectId) {
    try {
      const b = await checkBudget(opts.projectId);
      if (!b.allowed) {
        budgetBlocked = b.reason;
        await emit(`Budget guard: ${b.reason}`);
      }
    } catch {}
  }
  if (!budgetBlocked) {
    await emit(`Drafting ranked actions with AI (${slim.length} issues, ${pageSlim.length} pages)…`);
    const validated = await callLLMValidated(
      BASE_RULES + ` Turn issues into a prioritized action queue. Follow the provided plan order unless severity demands otherwise. Buckets: DO_THIS_NOW (blocking), DO_THIS_NEXT (high value), WATCH, NO_ACTION. Only cite URLs from the provided samples. Return {"recs":[{category,priority(0-100),bucket,whatWrong,whyMatters,whatToChange,canAutomate,needsApproval,relatedIssueType,affectedUrls,confidence}]}`,
      user,
      StrategyListSchema,
      { maxTokens: 2000 }
    );
    if (validated) {
      await emit(`Verifying ${validated.data.recs.length} AI drafts against crawl evidence…`);
      const verified = verifyRecs(validated.data.recs as StrategyRec[], pages, issues);
      if (verified.length) {
        // Merge: ensure every critical issue is covered even if LLM skipped it
        const covered = new Set(verified.map((r) => r.relatedIssueType));
        const missing = deterministicRecs(sorted.filter((i) => i.severity === "critical" && !covered.has(i.type)));
        const merged = [...verified, ...missing].slice(0, 15);
        return {
          recs: merged,
          plan: { ...plan, createdBy: "planner:llm-enhanced" },
          usage: { tokens: validated.result.tokensUsed, cost: validated.result.costUsd, model: validated.result.model, durationMs: Date.now() - started },
        };
      }
    }
  }

  // Deterministic path ($0) — still planned + verified
  await emit(`Using deterministic ranking ($0, no invention)…`);
  const recs = verifyRecs(deterministicRecs(sorted), pages, issues);
  return { recs, plan, usage: { tokens: 0, cost: 0, model: budgetBlocked ? `deterministic (${budgetBlocked.slice(0, 80)})` : "deterministic", durationMs: Date.now() - started } };
}

function enforceFixShape(
  fix: { kind: string; current: string | null; proposed: string; reason: string },
  issue: RawIssue
): { kind: string; current: string | null; proposed: string; reason: string } | null {
  const proposed = fix.proposed?.trim();
  if (!proposed) return null;
  // Length guards: title 30–60 ideal (allow 20–70), meta 120–160 ideal (allow 100–170)
  if (issue.type === "title_length" || issue.type === "missing_title" || issue.type === "duplicate_title") {
    if (proposed.length < 10 || proposed.length > 90) return null;
  }
  if (issue.type === "missing_meta_description") {
    if (proposed.length < 60 || proposed.length > 200) return null;
  }
  return { kind: fix.kind || issue.type, current: fix.current ?? null, proposed: proposed.slice(0, 2000), reason: fix.reason || issue.recommendation };
}

export async function fixGeneratorAgent(
  issue: RawIssue,
  pages: ParsedPage[],
  opts?: { projectId?: string }
): Promise<{ fix: { kind: string; current: string | null; proposed: string; reason: string } | null; usage: { tokens: number; cost: number; model: string; durationMs: number } }> {
  const started = Date.now();
  if (opts?.projectId) {
    try {
      const b = await checkBudget(opts.projectId);
      if (!b.allowed) {
        return { fix: fallbackFixForIssue(issue, pages), usage: { tokens: 0, cost: 0, model: "deterministic (budget-capped)", durationMs: Date.now() - started } };
      }
    } catch {}
  }
  const page = getPageByUrl(pages, issue.affectedUrls[0]) || pages[0];
  const ctx = {
    issue: { type: issue.type, title: issue.title, sample: issue.affectedUrls.slice(0, 3) },
    page: page ? {
      url: page.finalUrl, title: page.title, meta: page.metaDescription, h1: page.h1,
      h2s: (page.h2s || []).slice(0, 4), words: page.wordCount,
      images: (page.images || []).length, og: page.og || {},
    } : null,
  };
  const validated = await callLLMValidated(
    BASE_RULES + ` Generate ONE concrete fix for this issue on the given real page. Return {"kind":string,"current":string|null,"proposed":string,"reason":string}. Proposed must be copy-paste ready, 150-160 chars for meta, 50-60 for title. Cite only the given URL. No guarantees.`,
    JSON.stringify(ctx),
    FixSchema,
    { maxTokens: 600 }
  );
  if (validated) {
    const shaped = enforceFixShape(validated.data as { kind: string; current: string | null; proposed: string; reason: string }, issue);
    if (shaped) {
      return {
        fix: shaped,
        usage: { tokens: validated.result.tokensUsed, cost: validated.result.costUsd, model: validated.result.model, durationMs: Date.now() - started },
      };
    }
  }
  // Fallback single attempt (non-validated, for backward compat with older models)
  const llm = await callLLM(
    BASE_RULES + ` Generate ONE concrete fix for this issue on the given real page. Return {"kind":string,"current":string|null,"proposed":string,"reason":string}.`,
    JSON.stringify(ctx),
    { json: true, maxTokens: 600, retries: 0 }
  );
  if (llm) {
    try {
      const j = JSON.parse(llm.text);
      if (j.proposed) {
        const shaped = enforceFixShape(
          { kind: j.kind || issue.type, current: j.current ?? null, proposed: String(j.proposed), reason: j.reason || issue.recommendation },
          issue
        );
        if (shaped) return { fix: shaped, usage: { tokens: llm.tokensUsed, cost: llm.costUsd, model: llm.model, durationMs: Date.now() - started } };
      }
    } catch {}
  }
  return { fix: fallbackFixForIssue(issue, pages), usage: { tokens: 0, cost: 0, model: "deterministic", durationMs: Date.now() - started } };
}

export async function contentOppsAgent(pages: ParsedPage[]) {
  return fallbackContentOpps(pages);
}
