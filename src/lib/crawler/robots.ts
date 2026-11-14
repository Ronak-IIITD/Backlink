import robotsParser from "robots-parser";
import { publicRequest, CRAWLER_USER_AGENT } from "@/lib/security/http";

const cache = new Map<string, { parser: ReturnType<typeof robotsParser>; at: number }>();
export async function getRobotsParser(origin: string, signal?: AbortSignal) {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.parser;
  const response = await publicRequest(`${origin}/robots.txt`, { timeoutMs: 8000, maxBytes: 500_000, signal });
  if (response.status >= 500 || response.status === 429) throw new Error("robots.txt unavailable; crawl deferred");
  const text = [401, 403].includes(response.status) ? "User-agent: *\nDisallow: /" :
    response.status >= 200 && response.status < 300 ? response.body.toString("utf8") : "";
  const parser = robotsParser(`${origin}/robots.txt`, text);
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(origin, { parser, at: Date.now() });
  return parser;
}
export async function isAllowedByRobots(url: string, userAgent = CRAWLER_USER_AGENT, signal?: AbortSignal) {
  const parser = await getRobotsParser(new URL(url).origin, signal);
  return parser.isAllowed(url, userAgent) !== false;
}
