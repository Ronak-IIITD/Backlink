import { prisma } from "@/lib/db";
import { getSessionUser, getUserOrgIds } from "@/lib/auth";
import { ProjectInputSchema, normalizeUrl } from "@/lib/url-validation";
import { assertUrlSafe } from "@/lib/security/ssrf";
import { ok, fail, toStatus } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET() {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const orgIds = await getUserOrgIds(u.id);
    const projects = await prisma.project.findMany({
      where: { organizationId: { in: orgIds } },
      orderBy: { updatedAt: "desc" },
      include: { crawls: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return ok(projects);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function POST(req: Request) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const rl = rateLimit("projects:" + u.id, 20, 60_000);
    if (!rl.ok) return fail("Rate limited", 429);
    const body = await req.json().catch(() => ({}));
    const parsed = ProjectInputSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    let websiteUrl: string;
    try {
      websiteUrl = normalizeUrl(parsed.data.websiteUrl);
      await assertUrlSafe(websiteUrl); // SSRF check at onboarding
    } catch (e: any) {
      return fail(e.message || "Invalid website URL", 400);
    }
    const orgIds = await getUserOrgIds(u.id);
    if (!orgIds.length) return fail("No organization", 400);
    const orgId = orgIds[0];
    const project = await prisma.project.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name || (() => { try { return new URL(websiteUrl).hostname; } catch { return websiteUrl; } })(),
        websiteUrl,
        businessName: parsed.data.businessName,
        businessType: parsed.data.businessType,
        targetCountry: parsed.data.targetCountry,
        targetCity: parsed.data.targetCity,
        targetKeywords: JSON.stringify(parsed.data.targetKeywords || []),
      },
    });
    if (parsed.data.targetKeywords?.length) {
      for (const term of parsed.data.targetKeywords.slice(0, 20)) {
        await prisma.keyword.create({ data: { projectId: project.id, term } });
      }
    }
    if (parsed.data.competitors?.length) {
      for (const c of parsed.data.competitors.slice(0, 10)) {
        try {
          const cu = normalizeUrl(c);
          await prisma.competitor.create({ data: { projectId: project.id, url: cu } });
        } catch {}
      }
    }
    await prisma.auditLog.create({ data: { userId: u.id, action: "project.create", entity: "project", entityId: project.id, meta: JSON.stringify({ websiteUrl }) } });
    return ok(project, 201);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
