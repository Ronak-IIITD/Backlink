import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { applyAction, adapterStatus } from "@/lib/cms";

/**
 * Approval-gated auto-apply: only works on status=approved actions.
 * Never auto-applies awaiting_approval/drafted — approval boundary enforced.
 */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const action = await prisma.aIAction.findUnique({ where: { id: params.id } });
    if (!action) return fail("NOT_FOUND", 404);
    if (action.status !== "approved") {
      return fail(`Only approved fixes can be applied (current: ${action.status}). Approve first.`, 409);
    }
    const crawl = await prisma.crawl.findUnique({ where: { id: action.crawlId } });
    if (!crawl) return fail("NOT_FOUND", 404);
    const project = await prisma.project.findUnique({ where: { id: crawl.projectId } });
    if (!project) return fail("NOT_FOUND", 404);
    const ms = await prisma.membership.findMany({ where: { userId: u.id } });
    if (!ms.some((m) => m.organizationId === project.organizationId)) return fail("FORBIDDEN", 403);

    let targetUrls: string[] = [];
    try {
      const p = action.payload ? JSON.parse(action.payload) : null;
      if (Array.isArray(p?.urls)) targetUrls = p.urls;
    } catch {}
    const result = await applyAction(
      {
        actionId: action.id,
        projectId: project.id,
        websiteUrl: project.websiteUrl,
        kind: action.kind,
        currentValue: action.currentValue,
        proposedValue: action.proposedValue || "",
        targetUrls,
        payload: action.payload,
      },
      { cmsAdapter: (project as any).cmsAdapter, cmsWebhookUrl: (project as any).cmsWebhookUrl, cmsWebhookSecret: (project as any).cmsWebhookSecret }
    );

    if (result.applied) {
      const updated = await prisma.aIAction.update({
        where: { id: action.id },
        data: { status: "applied", appliedAt: new Date(), error: null },
      });
      await prisma.auditLog.create({ data: { userId: u.id, action: "action.applied", entity: "aiaction", entityId: action.id, meta: JSON.stringify({ adapter: result.adapter }) } });
      return ok({ action: updated, apply: result });
    }
    // Not applied (e.g. manual mode or adapter error) — stays approved, safe to retry
    await prisma.auditLog.create({ data: { userId: u.id, action: "action.apply_attempt", entity: "aiaction", entityId: action.id, meta: JSON.stringify({ adapter: result.adapter, message: result.message }).slice(0, 1000) } });
    return ok({ action, apply: result, adapters: adapterStatus({ cmsAdapter: (project as any).cmsAdapter, cmsWebhookUrl: (project as any).cmsWebhookUrl }) });
  } catch (e: any) {
    return fail(e.message || "apply failed", 500);
  }
}

export async function GET() {
  return ok({ adapters: adapterStatus(), rule: "Only status=approved actions can be applied. Approve first, then apply." });
}
