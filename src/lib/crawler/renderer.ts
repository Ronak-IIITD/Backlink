import { assertUrlSafe } from "@/lib/security/ssrf";
import { reserveProvider, settleProvider } from "@/lib/pilot/providers";
import { sameSite } from "./scope";

export async function readBoundedBody(response: Response, maxBytes = 2_000_000): Promise<string> {
  if (Number(response.headers.get("content-length") || 0) > maxBytes) { await response.body?.cancel(); throw new Error("Response exceeds byte limit"); }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error("Response exceeds byte limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function renderPage(url: string, organizationId: string, signal: AbortSignal, crawlId?: string) {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) throw new Error("JavaScript rendering is not configured. Contact support or select HTML-only crawling.");
  await assertUrlSafe(url);
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted();
    const call = await reserveProvider("render", organizationId, 5);
    let settled = false;
    try {
      const endpoint = new URL("https://app.scrapingbee.com/api/v1/");
      endpoint.searchParams.set("url", url);
      endpoint.searchParams.set("render_js", "true");
      endpoint.searchParams.set("transparent_status_code", "true");
      endpoint.searchParams.set("premium_proxy", "false");
      endpoint.searchParams.set("stealth_proxy", "false");
      endpoint.searchParams.set("wait_browser", "networkidle0");
      endpoint.searchParams.set("wait", "1000");
      endpoint.searchParams.set("timeout", "25000");
      if (crawlId) endpoint.searchParams.set("tag", crawlId);
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]), redirect: "error",
      });
      const requestId = response.headers.get("spb-request-id") || undefined;
      const cost = response.headers.get("spb-cost");
      await settleProvider(call.id, cost !== null && /^\d+$/.test(cost) ? Number(cost) : undefined, 0, requestId);
      settled = true;
      if (!response.ok) {
        await response.body?.cancel();
        if ((response.status >= 500 || response.status === 429) && attempt === 0 && !signal.aborted) continue;
        throw new Error(`JavaScript renderer unavailable (${response.status}); content was not audited`);
      }
      const finalUrl = response.headers.get("spb-resolved-url");
      if (!finalUrl) { await response.body?.cancel(); throw new Error("Renderer omitted the final URL; content was not audited"); }
      await assertUrlSafe(finalUrl);
      if (!sameSite(url, finalUrl)) { await response.body?.cancel(); throw new Error("Rendered page left the website's domain"); }
      const html = await readBoundedBody(response);
      if (!/<html\b|<!doctype\s+html/i.test(html)) throw new Error("Renderer did not return a usable HTML document");
      return { html, finalUrl, requestId };
    } catch (error) {
      if (!settled) await settleProvider(call.id);
      // Transport timeouts may have been billed; retain their reservation.
      if (attempt === 0 && !signal.aborted && (error as Error).name === "TimeoutError") continue;
      throw error;
    }
  }
  throw new Error("JavaScript rendering failed");
}
