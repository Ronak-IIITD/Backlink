import { z } from "zod";
import { publicProject } from "@/lib/pilot/project";
import { currentAccess } from "@/lib/pilot/access";
import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus, apiError } from "@/lib/api";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    const latestCrawl = await prisma.crawl.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } });
    let score: any = null;
    let report: any = null;
    if (latestCrawl?.status === "completed") {
      report = await prisma.report.findFirst({ where: { crawlId: latestCrawl.id }, orderBy: { createdAt: "desc" } });
      if (report && latestCrawl.scoreVersion >= 2) {
        try { score = JSON.parse(report.summary); } catch {}
      }
    }
    const counts = latestCrawl?.status === "completed"
      ? {
          issues: await prisma.sEOIssue.count({ where: { crawlId: latestCrawl.id } }),
          critical: await prisma.sEOIssue.count({ where: { crawlId: latestCrawl.id, severity: "critical" } }),
          pages: await prisma.page.count({ where: { crawlId: latestCrawl.id } }),
        }
      : null;
    return ok({ project: publicProject(project), latestCrawl, score, report, counts, legacyAudit: !!latestCrawl && latestCrawl.scoreVersion < 2 });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(user.id, (await props.params).id);
    await currentAccess(prisma, project.organizationId);
    const parsed = z.object({ renderMode: z.enum(["html", "javascript"]) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Choose HTML or JavaScript rendering.", 400);
    if (await prisma.crawl.findUnique({ where: { activeProjectId: project.id } })) return fail("Wait for the active audit before changing rendering mode.", 409);
    const updated = await prisma.project.update({ where: { id: project.id }, data: parsed.data });
    await prisma.auditLog.create({ data: { userId: user.id, action: "project.render_mode", entity: "project", entityId: project.id, meta: JSON.stringify(parsed.data) } });
    return ok(publicProject(updated));
  } catch (error) { return apiError(error); }
}
