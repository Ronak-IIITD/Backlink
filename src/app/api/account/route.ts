import { prisma } from "@/lib/db";
import { getSessionUser, getUserOrgIds } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { currentAccess } from "@/lib/pilot/access";
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    const orgId = (await getUserOrgIds(user.id))[0];
    if (!orgId) return fail("NOT_FOUND", 404);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    let period = null;
    try { period = await currentAccess(prisma, orgId); } catch { /* Expired accounts keep read access. */ }
    const latest = period || await prisma.accessPeriod.findFirst({ where: { organizationId: orgId }, orderBy: { endsAt: "desc" } });
    return ok({ organization: { id: org.id, name: org.name },
      status: org.suspended ? "suspended" : !period ? "expired" : period.kind === "paid" ? "active" : "trial",
      period: latest && { startsAt: latest.startsAt, endsAt: latest.endsAt, kind: latest.kind },
      usage: { websites: await prisma.project.count({ where: { organizationId: orgId } }), audits: latest?.auditsUsed || 0, drafts: latest?.draftsUsed || 0 },
      limits: { websites: 1, pagesPerAudit: 30, audits: latest?.auditLimit || 0, drafts: latest?.draftLimit || 0 },
      supportEmail: process.env.SUPPORT_EMAIL || null, price: { amount: 29, currency: "USD", renewal: "manual" } });
  } catch (error) { return apiError(error); }
}
