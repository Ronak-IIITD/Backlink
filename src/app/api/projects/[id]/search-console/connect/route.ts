import { NextResponse } from "next/server";
import { assertProjectAccess, getSessionUser } from "@/lib/auth";
import { createSearchConsoleAuthorizationUrl, searchConsoleIsConfigured } from "@/lib/search-console";
import { fail, toStatus } from "@/lib/api";
import psl from "psl";

function registrableDomain(hostname: string) {
  const parsed = psl.parse(hostname);
  return "domain" in parsed && parsed.domain ? parsed.domain : hostname.toLowerCase();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(user.id, params.id);
    if (!searchConsoleIsConfigured()) return fail("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Search Console.", 503);
    const requestUrl = new URL(request.url);
    const siteUrl = requestUrl.searchParams.get("siteUrl")?.trim() || project.websiteUrl;
    const host = project.websiteUrl && new URL(project.websiteUrl).hostname;
    let selectedHost: string;
    try {
      selectedHost = siteUrl.startsWith("sc-domain:") ? siteUrl.slice("sc-domain:".length) : new URL(siteUrl).hostname;
    } catch { return fail("Enter a valid Search Console property.", 400); }
    if (registrableDomain(host) !== registrableDomain(selectedHost)) return fail("Choose a Search Console property for this website's domain.", 400);
    const authorizationUrl = createSearchConsoleAuthorizationUrl(project.id, siteUrl, user.id, new URL(request.url).origin);
    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    return fail(error.message || "Could not start Search Console authorization", toStatus(error));
  }
}
