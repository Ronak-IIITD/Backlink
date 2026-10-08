import { prisma } from "@/lib/db";
import { assertProjectAccess, getSessionUser } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { disconnectSearchConsole, getSearchConsoleData, searchConsoleIsConfigured } from "@/lib/search-console";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(user.id, params.id);
    const connection = await prisma.searchConsoleConnection.findUnique({ where: { projectId: project.id }, select: { siteUrl: true, connectedAt: true } });
    if (!connection) return ok({ connected: false, configured: searchConsoleIsConfigured() });
    let data;
    try { data = await getSearchConsoleData(project.id); }
    catch (error: any) { return ok({ connected: true, siteUrl: connection.siteUrl, error: error.message || "Search Console data could not be loaded" }); }
    if (!data) return ok({ connected: false, configured: true });
    const start = new Date(`${data.period.startDate}T00:00:00.000Z`);
    const end = new Date(`${data.period.endDate}T23:59:59.999Z`);
    const crawls = await prisma.crawl.findMany({ where: { projectId: project.id }, select: { id: true } });
    const actions = await prisma.aIAction.findMany({
      where: { status: "applied", appliedAt: { gte: start, lte: end }, crawlId: { in: crawls.map((crawl) => crawl.id) } },
      select: { id: true, kind: true, appliedAt: true, proposedValue: true },
      orderBy: { appliedAt: "desc" },
      take: 10,
    });
    return ok({ connected: true, ...data, appliedChanges: actions });
  } catch (error: any) {
    return fail(error.message || "Could not load Search Console data", toStatus(error));
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(user.id, params.id);
    await disconnectSearchConsole(project.id);
    await prisma.auditLog.create({ data: { userId: user.id, action: "search_console.disconnect", entity: "project", entityId: project.id } });
    return ok({ connected: false });
  } catch (error: any) {
    return fail(error.message || "Could not disconnect Search Console", toStatus(error));
  }
}
