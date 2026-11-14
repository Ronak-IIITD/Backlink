import dns from "node:dns/promises";
import net from "node:net";

/** Fail closed: only globally routable addresses may be contacted. */
export function isPrivateIp(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (ip.includes("%")) return true;
  if (net.isIPv4(ip)) {
    const [a, b, c] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (!net.isIPv6(ip)) return true;
  // WHATWG canonicalization converts dotted IPv4-mapped addresses to hex.
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  if (canonical.startsWith("::ffff:")) {
    const parts = canonical.slice(7).split(":");
    const high = parseInt(parts[0], 16), low = parseInt(parts[1], 16);
    return isPrivateIp(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  // Global unicast only; reject transition, documentation and benchmark ranges.
  const first = parseInt(canonical.split(":")[0], 16);
  return !Number.isFinite(first) || first < 0x2000 || first > 0x3fff || canonical.startsWith("2002:") ||
    /^2001:(?:0:|:|db8:|2:|10:|20:)/.test(canonical);
}

export function validatePublicUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) URLs are allowed");
  if (url.username || url.password) throw new Error("URLs with credentials are blocked");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Only ports 80 and 443 are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (["localhost", "metadata.google.internal"].includes(host) ||
      [".internal", ".local", ".localhost", ".invalid", ".test"].some((s) => host.endsWith(s))) {
    throw new Error("Blocked internal host");
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new Error("Blocked private IP range");
  return url;
}

export async function resolvePublicUrl(value: string) {
  const url = validatePublicUrl(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("Blocked: destination is not exclusively public");
  }
  return { url, addresses };
}

export async function assertUrlSafe(value: string): Promise<URL> {
  const timeout = AbortSignal.timeout(8000);
  return Promise.race([
    resolvePublicUrl(value).then((result) => result.url),
    new Promise<never>((_, reject) => timeout.addEventListener("abort", () => reject(new Error("DNS lookup timed out")), { once: true })),
  ]);
}
