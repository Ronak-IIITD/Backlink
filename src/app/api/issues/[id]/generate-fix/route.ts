import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { fixGeneratorAgent } from "@/lib/ai/orchestrator";
import { ok, fail, apiError } from "@/lib/api";
import { transaction, reserveUsage, settleUsage, settleUsageTx, PilotError } from "@/lib/pilot/access";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  let pending: { id: string; reservationId: string | null } | undefined;
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    if (!(await rateLimit(`draft:${user.id}`, 10, 60000)).ok) return fail("Please wait before generating another draft.", 429);
    const { id } = await props.params;
    const issue = await prisma.sEOIssue.findUnique({ where: { id }, include: { crawl: true } });
    if (!issue) return fail("NOT_FOUND", 404);
    const project = await assertProjectAccess(user.id, issue.crawl.projectId);
    if (issue.crawl.status !== "completed" || issue.crawl.scoreVersion < 2) return fail("Complete a new audit before generating fixes.", 409);
    const affected: string[] = JSON.parse(issue.affectedUrls);
    const pages = await prisma.page.findMany({ where: { crawlId: issue.crawlId, auditError: null, statusCode: 200 } });
    const page = pages.find((p) => affected.includes(p.url) || (p.finalUrl && affected.includes(p.finalUrl)));
    if (!page) return fail("No audited page is available for this fix. Follow the manual recommendation.", 422);
    const target = affected.find((url) => url === page.url || url === page.finalUrl)!;
    const prepared = await transaction(async (tx) => {
      const existing = await tx.aIAction.findFirst({ where: { issueId: id, status: { notIn: ["rejected", "failed"] } }, orderBy: { createdAt: "desc" } });
      if (existing?.status === "generating") throw new PilotError("DRAFT_IN_PROGRESS", "This fix is being generated. Please wait.", 409);
      if (existing) return { action: existing, existing: true };
      const actionId = randomUUID();
      const reservation = await reserveUsage(tx, project.organizationId, "draft", `draft:${actionId}`);
      const action = await tx.aIAction.create({ data: { id: actionId, crawlId: issue.crawlId, issueId: id, activeIssueId: id,
        reservationId: reservation.id, kind: issue.type, status: "generating", payload: JSON.stringify({ issueType: issue.type, urls: [target] }) } });
      return { action, existing: false };
    });
    if (prepared.existing) return ok(prepared.action);
    pending = prepared.action;
    const parse = (value: string | null, fallback: any) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
    const parsedPage = { ...page, auditError: page.auditError || undefined, finalUrl: page.finalUrl || page.url, contentType: page.contentType || "", statusCode: page.statusCode || 0,
      h2s: parse(page.h2s, []), bodyText: page.bodyText || "", links: parse(page.links, []), images: parse(page.images, []),
      og: parse(page.og, {}), schemaTypes: parse(page.schemaTypes, []), robotsDirectives: parse(page.robotsDirectives, { noindex: false, nofollow: false }) };
    const { fix, usage } = await fixGeneratorAgent({ ...issue, severity: issue.severity as any, difficulty: issue.difficulty as any, affectedUrls: [target] }, [parsedPage], { projectId: project.id });
    if (!fix) throw new PilotError("MANUAL_FIX_REQUIRED", "Follow the recommendation manually; this issue has no supported fix draft.", 422);
    const action = await transaction(async (tx) => {
      const updated = await tx.aIAction.update({ where: { id: prepared.action.id }, data: { status: "awaiting_approval", activeIssueId: null,
        kind: fix.kind, currentValue: fix.current, proposedValue: fix.proposed, reason: fix.reason } });
      await tx.agentRun.create({ data: { projectId: project.id, crawlId: issue.crawlId, agent: "fix_generator", tokensUsed: usage.tokens,
        costUsd: usage.cost, durationMs: usage.durationMs, input: JSON.stringify({ issue: issue.type, target }), output: JSON.stringify({ kind: fix.kind, model: usage.model }) } });
      await tx.auditLog.create({ data: { userId: user.id, action: "fix.generate", entity: "aiaction", entityId: updated.id } });
      await settleUsageTx(tx, pending!.reservationId, true);
      return updated;
    });
    return ok(action, 201);
  } catch (error) {
    if (pending) {
      await prisma.aIAction.updateMany({ where: { id: pending.id, status: "generating" }, data: { status: "failed", activeIssueId: null } });
      await settleUsage(pending.reservationId, false);
    }
    return apiError(error);
  }
}
