export interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  timeoutMs: number;
  rateLimitMs: number;
  renderMode?: "html" | "javascript";
  organizationId?: string;
  crawlId?: string;
  deadlineMs?: number;
}

export function getCrawlDefaults(): CrawlOptions {
  return {
    maxPages: Math.min(30, Math.max(1, Number(process.env.CRAWL_MAX_PAGES || 30) || 30)),
    maxDepth: Number(process.env.CRAWL_MAX_DEPTH || 3),
    timeoutMs: Number(process.env.CRAWL_TIMEOUT_MS || 12000),
    rateLimitMs: Number(process.env.CRAWL_RATE_LIMIT_MS || 400),
  };
}

export interface RawPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  html: string;
  sizeBytes: number;
  loadMs: number;
  depth: number;
  redirectChain: string[];
  xRobotsTag?: string;
  rendered?: boolean;
}

export interface ParsedPage {
  rendered?: boolean;
  auditError?: string;
  url: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  h1Count: number;
  h2s: string[];
  bodyText: string;
  wordCount: number;
  links: { href: string; text: string; internal: boolean }[];
  images: { src: string; alt: string | null }[];
  altMissingCount: number;
  og: Record<string, string>;
  schemaTypes: string[];
  robotsDirectives: { noindex: boolean; nofollow: boolean };
  indexable: boolean;
  sizeBytes: number;
  loadMs: number;
  depth: number;
}
