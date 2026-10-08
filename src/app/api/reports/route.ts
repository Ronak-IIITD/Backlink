import { prisma } from "@/lib/db";
import { getSessionUser, getUserOrgIds } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";

export async function GET() {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const orgIds = await getUserOrgIds(u.id);
    if (!orgIds.length) return ok([]);
    const projects = await prisma.project.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true, name: true, websiteUrl: true },
    });
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const reports = await prisma.report.findMany({
      where: { projectId: { in: projects.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const data = reports.map((r) => {
      let score: number | null = null;
      try {
        const s = JSON.parse(r.summary || "{}");
        if (typeof s.overall === "number") score = s.overall;
      } catch {}
      const p = projectMap.get(r.projectId);
      return {
        id: r.id,
        projectId: r.projectId,
        projectName: p?.name || "Site",
        websiteUrl: p?.websiteUrl || "",
        createdAt: r.createdAt,
        crawlId: r.crawlId,
        score,
        markdown: (r.markdown || "").slice(0, 2000),
      };
    });
    return ok(data);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
