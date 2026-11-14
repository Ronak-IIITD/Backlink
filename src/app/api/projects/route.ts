import { prisma } from "@/lib/db";
import { getSessionUser, getUserOrgIds } from "@/lib/auth";
import { ProjectInputSchema, normalizeUrl } from "@/lib/url-validation";
import { assertUrlSafe } from "@/lib/security/ssrf";
import { ok, fail, apiError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { transaction, currentAccess, PilotError } from "@/lib/pilot/access";
import { requestCrawl } from "@/lib/jobs/submit";
import { publicProject } from "@/lib/pilot/project";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const projects = await prisma.project.findMany({ where: { organizationId: { in: await getUserOrgIds(user.id) } },
      orderBy: { updatedAt: "desc" }, include: { crawls: { orderBy: { createdAt: "desc" }, take: 1 } } });
    return ok(projects.map(publicProject));
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    if (!(await rateLimit(`projects:${user.id}`, 10, 60000)).ok) return fail("Rate limited", 429);
    const parsed = ProjectInputSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    const data = parsed.data;
    let websiteUrl: string;
    try { websiteUrl = normalizeUrl(data.websiteUrl); await assertUrlSafe(websiteUrl); }
    catch { return fail("Enter a reachable public HTTP(S) website on port 80 or 443.", 400); }
    const orgId = (await getUserOrgIds(user.id))[0];
    if (!orgId) return fail("No workspace", 400);
    const project = await transaction(async (tx) => {
      await currentAccess(tx, orgId);
      if (await tx.project.count({ where: { organizationId: orgId } })) throw new PilotError("SITE_LIMIT_REACHED", "Your pilot includes one website.", 409);
      const row = await tx.project.create({ data: { organizationId: orgId, websiteUrl, name: data.name || new URL(websiteUrl).hostname,
        renderMode: data.renderMode, cmsAdapter: "manual", businessName: data.businessName, businessType: data.businessType,
        targetCountry: data.targetCountry, targetCity: data.targetCity, targetKeywords: JSON.stringify(data.targetKeywords) } });
      for (const term of data.targetKeywords) await tx.keyword.create({ data: { projectId: row.id, term } });
      await tx.auditLog.create({ data: { userId: user.id, action: "project.create", entity: "project", entityId: row.id } });
      return row;
    });
    // A queue outage must not hide the newly created project or consume the free audit.
    try { await requestCrawl(project.id, user.id); } catch { /* Project page offers a safe retry. */ }
    return ok(publicProject(project), 201);
  } catch (error) { return apiError(error); }
}
