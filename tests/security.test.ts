import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { gzipSync } from "node:zlib";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isPrivateIp, validatePublicUrl } from "@/lib/security/ssrf";
import { publicRequest } from "@/lib/security/http";

const responses: { status?: number; headers?: Record<string, string>; body?: Buffer; stall?: boolean }[] = [];
const lookups: any[] = [];
beforeEach(() => {
  vi.restoreAllMocks(); responses.length = 0; lookups.length = 0;
  vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
  const request = vi.fn((_url: any, options: any, callback: any) => {
    const req = new EventEmitter() as any;
    req.destroy = vi.fn();
    req.end = () => queueMicrotask(() => {
      options.lookup("example.com", { all: true }, (_error: any, addresses: any) => lookups.push(addresses));
      const next = responses.shift() || {};
      const res = new PassThrough() as any;
      res.statusCode = next.status || 200; res.headers = next.headers || { "content-type": "text/html" };
      callback(res);
      if (!next.stall) res.end(next.body || Buffer.from("<html>hello</html>"));
    });
    return req;
  });
  vi.spyOn(http, "request").mockImplementation(request as any);
  vi.spyOn(https, "request").mockImplementation(request as any);
});
describe("network boundary", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "::ffff:a00:1", "fe90::1", "2001:db8::1", "2002:7f00:1::", "not-an-ip"])("blocks %s", (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("accepts public %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
  it.each(["http://127.1", "http://2130706433", "http://[::ffff:127.0.0.1]", "https://example.com:8080", "http://user:pass@example.com", "file:///etc/passwd", "https://metadata.google.internal."])("rejects unsafe URL %s", (url) => expect(() => validatePublicUrl(url)).toThrow());
  it("pins the resolved public address rather than resolving again on connection", async () => {
    vi.mocked(dns.lookup).mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }] as any).mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as any);
    const result = await publicRequest("https://example.com/");
    expect(result.status).toBe(200); expect(lookups[0]).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect(dns.lookup).toHaveBeenCalledTimes(1);
  });
  it("rejects mixed public/private DNS records before making a request", async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }] as any);
    await expect(publicRequest("https://example.com")).rejects.toThrow("not exclusively public");
    expect(https.request).not.toHaveBeenCalled();
  });
  it("checks redirect destinations", async () => {
    responses.push({ status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    await expect(publicRequest("https://example.com")).rejects.toThrow("private IP");
    expect(https.request).toHaveBeenCalledTimes(1); expect(http.request).not.toHaveBeenCalled();
  });
  it("bounds redirect chains", async () => {
    responses.push(...Array.from({ length: 6 }, () => ({ status: 302, headers: { location: "/again" } })));
    await expect(publicRequest("https://example.com")).rejects.toThrow("Too many redirects");
  });
  it("keeps the deadline active while reading the response body", async () => {
    responses.push({ stall: true });
    await expect(publicRequest("https://example.com", { timeoutMs: 20 })).rejects.toThrow("timed out");
  });
  it("bounds decompressed data", async () => {
    responses.push({ headers: { "content-encoding": "gzip" }, body: gzipSync("a".repeat(10000)) });
    await expect(publicRequest("https://example.com", { maxBytes: 200 })).rejects.toThrow("Decoded response exceeds");
  });
  it("fails closed on DNS failure", async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error("DNS unavailable"));
    await expect(publicRequest("https://example.com")).rejects.toThrow("DNS unavailable");
    expect(https.request).not.toHaveBeenCalled();
  });
});
