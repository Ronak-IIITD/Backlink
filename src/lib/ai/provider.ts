import { prisma } from "@/lib/db";
import { reserveProvider, settleProvider } from "@/lib/pilot/providers";
import { readBoundedBody } from "@/lib/crawler/renderer";

export interface LLMResult { text: string; tokensUsed: number; costUsd: number; model: string }
type Options = { json?: boolean; maxTokens?: number; timeoutMs?: number; retries?: number; projectId?: string };
export async function callLLM(system: string, user: string, opts: Options = {}): Promise<(LLMResult & { retries: number }) | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !opts.projectId) return null;
  const project = await prisma.project.findUnique({ where: { id: opts.projectId }, select: { organizationId: true } });
  if (!project) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const mini = model === "gpt-4o-mini";
  const inputRate = Number(process.env.AI_INPUT_USD_PER_MILLION || (mini ? 0.15 : 0));
  const outputRate = Number(process.env.AI_OUTPUT_USD_PER_MILLION || (mini ? 0.6 : 0));
  if (!(inputRate > 0 && outputRate > 0)) return null;
  const reserveMicros = Math.floor(Number(process.env.AI_PER_RUN_COST_CAP_USD || 0.25) * 1_000_000);
  const maxTokens = Math.min(opts.maxTokens || 1200, 2000);
  if (!Number.isSafeInteger(reserveMicros) || reserveMicros < 1 || ((system.length + user.length) * inputRate + maxTokens * outputRate) > reserveMicros) return null;
  const dailyCap = Number(process.env.AI_DAILY_TOKEN_CAP || 500000);
  const dailyUsage = await prisma.providerCall.aggregate({ where: { organizationId: project.organizationId, provider: "ai", createdAt: { gte: new Date(Date.now() - 86400000) } }, _sum: { tokens: true } });
  if ((dailyUsage._sum.tokens || 0) >= dailyCap) return null;
  for (let attempt = 0; attempt < Math.min(3, (opts.retries ?? 1) + 1); attempt++) {
    let call;
    try { call = await reserveProvider("ai", project.organizationId, reserveMicros, system.length + user.length + maxTokens); }
    catch { return null; } // Fail closed, while keeping deterministic drafts available.
    let settled = false;
    try {
      const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(Math.min(opts.timeoutMs || 45000, 45000)),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature: 0.3, max_tokens: maxTokens, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        // Explicit rejection did not produce a completion. Never log upstream bodies or credentials.
        await settleProvider(call.id, response.status >= 400 && response.status < 500 ? 0 : undefined, 0, response.headers.get("x-request-id") || undefined);
        settled = true;
        if (response.status < 500 && response.status !== 429) return null;
        continue;
      }
      const result = JSON.parse(await readBoundedBody(response, 500000));
      const text = String(result.choices?.[0]?.message?.content || "");
      const input = result.usage?.prompt_tokens ?? (system.length + user.length);
      const output = result.usage?.completion_tokens ?? text.length;
      const tokensUsed = result.usage?.total_tokens ?? input + output;
      const micros = Math.ceil(input * inputRate + output * outputRate);
      await settleProvider(call.id, micros, tokensUsed, response.headers.get("x-request-id") || undefined);
      settled = true;
      if (text.trim()) return { text, tokensUsed, costUsd: micros / 1_000_000, model, retries: attempt };
    } catch {
      if (!settled) await settleProvider(call.id).catch(() => {});
    }
  }
  return null;
}
export async function callLLMValidated<T>(system: string, user: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: unknown } },
  opts?: { maxTokens?: number; projectId?: string }): Promise<{ data: T; result: LLMResult & { retries: number } } | null> {
  const first = await callLLM(system, user, { ...opts, json: true, maxTokens: opts?.maxTokens || 2000, retries: 1 });
  if (!first) return null;
  const parse = (text: string): T | null => {
    try {
      const raw = JSON.parse(text);
      // Preserve wrapper schemas such as {recs:[...]} before trying a bare payload.
      for (const value of [raw, raw.recs ?? raw.recommendations ?? raw.data]) {
        const result = schema.safeParse(value);
        if (result.success && result.data !== undefined) return result.data;
      }
    } catch { /* Invalid AI output is never returned as a fix. */ }
    return null;
  };
  const data = parse(first.text);
  if (data) return { data, result: first };
  const repair = await callLLM(system + " Return only valid JSON matching the originally requested shape.",
    `${user}\nRepair your previous response:\n${first.text.slice(0, 4000)}`,
    { ...opts, json: true, maxTokens: opts?.maxTokens || 2000, retries: 0 });
  if (!repair) return null;
  const fixed = parse(repair.text);
  return fixed ? { data: fixed, result: { ...repair, tokensUsed: first.tokensUsed + repair.tokensUsed,
    costUsd: first.costUsd + repair.costUsd, retries: first.retries + 1 } } : null;
}
