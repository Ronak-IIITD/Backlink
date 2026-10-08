import { assertUrlSafe } from "@/lib/security/ssrf";
import type { RawPage } from "./types";

const MAX_BYTES = 2_000_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchPage(url: string, timeoutMs: number, retries = 2): Promise<RawPage> {
  await assertUrlSafe(url);
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const start = Date.now();
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "SEOAgent/1.0 (+https://seo-agent.app/bot)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      // manual redirect handling (max 5) to capture chain + final URL
      let current = url;
      let response = res;
      const chain: string[] = [url];
      let hops = 0;
      while ([301, 302, 303, 307, 308].includes(response.status) && hops < 5) {
        const loc = response.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current).toString();
        await assertUrlSafe(next);
        chain.push(next);
        current = next;
        response = await fetch(current, {
          signal: ctrl.signal,
          redirect: "manual",
          headers: { "User-Agent": "SEOAgent/1.0 (+https://seo-agent.app/bot)", Accept: "text/html,application/xhtml+xml" },
        });
        hops++;
      }
      const loadMs = Date.now() - start;
      clearTimeout(t);
      const ct = response.headers.get("content-type") || "";
      const statusCode = response.status;
      // Only parse HTML; still return stub for non-HTML to record status
      if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
        return {
          url, finalUrl: current, statusCode, contentType: ct,
          html: "", sizeBytes: 0, loadMs, depth: 0, redirectChain: chain,
        };
      }
      const buf = await response.arrayBuffer();
      const bytes = Buffer.from(buf.slice(0, MAX_BYTES));
      const html = bytes.toString("utf8");
      return {
        url, finalUrl: current, statusCode, contentType: ct,
        html, sizeBytes: bytes.length, loadMs, depth: 0, redirectChain: chain,
      };
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < retries) await sleep(300 * (attempt + 1));
    }
  }
  throw new Error(`Fetch failed for ${url}: ${lastErr?.message || "unknown"}`);
}
