import http from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { resolvePublicUrl } from "./ssrf";

export const CRAWLER_USER_AGENT = "SEOAgent/1.0";
export interface PublicResponse {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  redirectChain: string[];
  loadMs: number;
}

/** Resolve once and pin the validated IP at connect time, preserving TLS SNI. */
export async function publicRequest(value: string, options: {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number; signal?: AbortSignal;
} = {}): Promise<PublicResponse> {
  const started = Date.now();
  const deadline = started + Math.min(options.timeoutMs ?? 12000, 30000);
  const maxBytes = options.maxBytes ?? 2_000_000;
  const chain = [value];
  let current = value;
  for (let hop = 0; hop <= (options.maxRedirects ?? 5); hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Request timed out");
    const result = await new Promise<Omit<PublicResponse, "redirectChain">>((resolve, reject) => {
      let request: http.ClientRequest | undefined;
      let response: http.IncomingMessage | undefined;
      let decoder: ReturnType<typeof createGunzip> | undefined;
      let settled = false;
      const finish = (error?: Error, result?: Omit<PublicResponse, "redirectChain">) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        if (error) { decoder?.destroy(); response?.destroy(); request?.destroy(); reject(error); }
        else resolve(result!);
      };
      const abort = () => finish(new Error("Request aborted"));
      const timer = setTimeout(() => finish(new Error("Request timed out")), remaining);
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) { abort(); return; }
      resolvePublicUrl(current).then(({ url, addresses }) => {
        if (settled) return;
        const pinned = addresses[0];
        request = (url.protocol === "https:" ? https : http).request(url, {
          agent: false,
          headers: { "User-Agent": CRAWLER_USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain", "Accept-Encoding": "identity" },
          lookup: ((_host: string, lookupOptions: { all?: boolean }, callback: (...args: any[]) => void) => {
            if (lookupOptions.all) callback(null, [pinned]);
            else callback(null, pinned.address, pinned.family);
          }) as any,
        }, (res) => {
          response = res;
          const status = res.statusCode ?? 0;
          const loadMs = Date.now() - started;
          if ([301, 302, 303, 307, 308].includes(status) && res.headers.location) {
            res.destroy();
            finish(undefined, { url: current, status, headers: res.headers, body: Buffer.alloc(0), loadMs });
            return;
          }
          const length = Number(res.headers["content-length"] || 0);
          if (length > maxBytes) { finish(new Error("Response exceeds byte limit")); return; }
          let wireBytes = 0, bytes = 0;
          const encoding = res.headers["content-encoding"];
          if (encoding === "gzip") decoder = createGunzip();
          else if (encoding === "br") decoder = createBrotliDecompress();
          else if (encoding === "deflate") decoder = createInflate();
          else if (encoding && encoding !== "identity") { finish(new Error("Unsupported content encoding")); return; }
          res.on("data", (chunk: Buffer) => {
            wireBytes += chunk.length;
            if (wireBytes > maxBytes) finish(new Error("Response exceeds byte limit"));
          });
          const stream = decoder ? res.pipe(decoder) : res;
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > maxBytes) finish(new Error("Decoded response exceeds byte limit"));
            else chunks.push(chunk);
          });
          res.on("aborted", () => finish(new Error("Response interrupted")));
          res.on("error", (error) => finish(error));
          stream.on("error", (error) => finish(error));
          stream.on("end", () => finish(undefined, { url: current, status, headers: res.headers, body: Buffer.concat(chunks), loadMs }));
        });
        request.on("error", (error) => finish(error));
        request.end();
      }).catch((error) => finish(error));
    });
    if (![301, 302, 303, 307, 308].includes(result.status) || !result.headers.location) {
      return { ...result, redirectChain: chain };
    }
    if (hop === (options.maxRedirects ?? 5)) throw new Error("Too many redirects");
    current = new URL(result.headers.location, current).toString();
    chain.push(current);
  }
  throw new Error("Too many redirects");
}
