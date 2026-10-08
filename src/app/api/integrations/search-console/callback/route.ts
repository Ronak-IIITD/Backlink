import { NextResponse } from "next/server";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/api";
import { saveSearchConsoleConnection, verifySearchConsoleState } from "@/lib/search-console";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  let projectId = "";
  try {
    const stateData = verifySearchConsoleState(state);
    projectId = stateData.projectId;
    const user = await getSessionUser();
    if (!user || user.id !== stateData.userId) throw new Error("Your session expired. Sign in and reconnect Search Console.");
    await assertProjectAccess(user.id, projectId);
    if (url.searchParams.has("error")) throw new Error("Search Console access was not granted.");
    const code = url.searchParams.get("code");
    if (!code) throw new Error("Google did not return an authorization code.");
    await saveSearchConsoleConnection(projectId, stateData.siteUrl, code, url.origin);
    await prisma.auditLog.create({ data: { userId: user.id, action: "search_console.connect", entity: "project", entityId: projectId } });
    return NextResponse.redirect(new URL(`/projects/${projectId}?searchConsole=connected`, url.origin));
  } catch (error: any) {
    const destination = projectId ? `/projects/${projectId}` : "/settings";
    const redirect = new URL(destination, url.origin);
    redirect.searchParams.set("searchConsole", "error");
    redirect.searchParams.set("message", error.message || "Search Console connection failed");
    return NextResponse.redirect(redirect);
  }
}
