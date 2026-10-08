import { z } from "zod";

export const ProjectInputSchema = z.object({
  websiteUrl: z.string().min(4).max(2048),
  name: z.string().min(1).max(120).optional(),
  businessName: z.string().max(120).optional(),
  businessType: z.string().max(120).optional(),
  targetCountry: z.string().max(80).optional(),
  targetCity: z.string().max(80).optional(),
  targetKeywords: z.array(z.string().max(100)).max(20).optional(),
  competitors: z.array(z.string().max(2048)).max(10).optional(),
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

/** Normalize user-entered URL: add https://, trim, remove fragments, validate http(s). */
export function normalizeUrl(input: string): string {
  let s = (input || "").trim();
  if (!s) throw new Error("URL is required");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  // strip fragment
  s = s.split("#")[0].trim();
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("Invalid URL. Example: https://example.com");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (!u.hostname.includes(".")) throw new Error("Invalid domain");
  if (u.username || u.password) throw new Error("URLs with credentials are not allowed");
  // normalize: lowercase host, remove default ports, trailing slash for root only
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
    u.port = "";
  }
  return u.toString();
}

export function getRegistrableDomain(hostname: string): string {
  // lightweight fallback without psl for tests; production uses psl in crawler
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

export function isValidProjectInput(raw: unknown) {
  return ProjectInputSchema.safeParse(raw);
}
