import { publicRequest } from "@/lib/security/http";
import type { RawPage } from "./types";

export async function fetchPage(url: string, timeoutMs: number, _retries = 0, signal?: AbortSignal): Promise<RawPage> {
  const response = await publicRequest(url, { timeoutMs, signal });
  const contentType = String(response.headers["content-type"] || "");
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);
  return {
    url, finalUrl: response.url, statusCode: response.status, contentType,
    html: isHtml ? response.body.toString("utf8") : "",
    sizeBytes: response.body.length, loadMs: response.loadMs, depth: 0,
    redirectChain: response.redirectChain,
    xRobotsTag: String(response.headers["x-robots-tag"] || ""),
  };
}
