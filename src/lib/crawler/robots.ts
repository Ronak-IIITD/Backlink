import robotsParser from "robots-parser";

const cache = new Map<string, { parser: any; at: number }>();

export async function getRobotsParser(origin: string, userAgent = "SEOAgent/1.0"): Promise<any> {
  const cached = cache.get(origin);
  if (cached && Date.now() - cached.at < 1000 * 60 * 60) return cached.parser;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(origin + "/robots.txt", { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    const text = res.ok ? await res.text() : "";
    const parser = robotsParser(origin + "/robots.txt", text);
    cache.set(origin, { parser, at: Date.now() });
    return parser;
  } catch {
    const parser = robotsParser(origin + "/robots.txt", "");
    cache.set(origin, { parser, at: Date.now() });
    return parser;
  }
}

export async function isAllowedByRobots(url: string, userAgent = "*"): Promise<boolean> {
  try {
    const u = new URL(url);
    const parser = await getRobotsParser(u.origin);
    const res = parser.isAllowed(url, userAgent);
    return res !== false;
  } catch {
    return true;
  }
}
