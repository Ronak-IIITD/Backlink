/** Pluggable LLM provider (OpenAI-compatible). Returns null when no key → caller uses deterministic fallback. */

export interface LLMResult {
  text: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
}

function estimateCost(model: string, inputChars: number, outputChars: number): number {
  // rough: $0.15/1M in, $0.60/1M out for mini-class; $2.50/$10 for full. Keep conservative.
  const isMini = /mini|haiku|flash/i.test(model);
  const inRate = isMini ? 0.15 / 1_000_000 : 2.5 / 1_000_000;
  const outRate = isMini ? 0.6 / 1_000_000 : 10 / 1_000_000;
  return (inputChars / 4) * inRate + (outputChars / 4) * outRate;
}

export async function callLLM(system: string, user: string, opts?: { json?: boolean; maxTokens?: number; timeoutMs?: number; retries?: number }): Promise<(LLMResult & { retries: number }) | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const maxAttempts = Math.max(1, Math.min(3, (opts?.retries ?? 1) + 1));
  let lastErr: any = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs || 45000);
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.3,
          max_tokens: opts?.maxTokens || 1200,
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      clearTimeout(t);
      if (!res.ok) {
        lastErr = new Error(`provider ${res.status}`);
        console.error("[ai] provider error", res.status, await res.text().catch(() => ""));
        if (res.status >= 400 && res.status < 500 && res.status !== 429) return null; // don't retry client errors
        continue;
      }
      const json = await res.json();
      const text: string = json.choices?.[0]?.message?.content || "";
      if (!text.trim()) { lastErr = new Error("empty completion"); continue; }
      const usage = json.usage || {};
      const tokensUsed = usage.total_tokens || Math.round((system.length + user.length + text.length) / 4);
      return { text, tokensUsed, costUsd: estimateCost(model, system.length + user.length, text.length), model, retries: attempt };
    } catch (e) {
      lastErr = e;
      console.error(`[ai] call failed attempt ${attempt + 1}/${maxAttempts}, using fallback if exhausted`, e);
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  console.error("[ai] all attempts failed", lastErr);
  return null;
}

/** Validated call: parses JSON + zod-validates, with one repair retry on invalid shape. */
export async function callLLMValidated<T>(
  system: string,
  user: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  opts?: { maxTokens?: number }
): Promise<{ data: T; result: LLMResult & { retries: number } } | null> {
  const first = await callLLM(system, user, { json: true, maxTokens: opts?.maxTokens || 2000, retries: 1 });
  if (!first) return null;
  const tryParse = (text: string): T | null => {
    try {
      const raw = JSON.parse(text);
      // allow {recs} | {recommendations} | bare array | bare object wrappers
      const candidate = (raw as any).recs ?? (raw as any).recommendations ?? (raw as any).data ?? raw;
      const arr = Array.isArray(candidate) ? candidate : (raw as any).fix ? raw : candidate;
      const parsed = schema.safeParse(arr);
      if (parsed.success && (parsed as any).data !== undefined) return (parsed as any).data as T;
      // also try raw directly if wrapper failed
      const direct = schema.safeParse(raw);
      if (direct.success) return (direct as any).data as T;
      return null;
    } catch {
      return null;
    }
  };
  const ok1 = tryParse(first.text);
  if (ok1) return { data: ok1, result: first };
  // repair pass: ask model to fix shape
  const repair = await callLLM(
    system + " Your last output failed schema validation. Return ONLY valid JSON matching the requested shape. No prose.",
    `Fix this JSON:\n${first.text.slice(0, 4000)}`,
    { json: true, maxTokens: opts?.maxTokens || 2000, retries: 0 }
  );
  if (!repair) return null;
  const ok2 = tryParse(repair.text);
  if (!ok2) return null;
  return {
    data: ok2,
    result: { text: repair.text, tokensUsed: first.tokensUsed + repair.tokensUsed, costUsd: first.costUsd + repair.costUsd, model: repair.model, retries: 1 },
  };
}
