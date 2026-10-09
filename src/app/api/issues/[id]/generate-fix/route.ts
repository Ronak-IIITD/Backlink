import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { fixGeneratorAgent } from "@/lib/ai/orchestrator";
import { ok, fail } from "@/lib/api";

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", 401);
  const issue = await prisma.sEOIssue.findUnique({ where: { id: params.id }, include: { crawl: true } });
  if (!issue) return fail("NOT_FOUND", 404);
  const project = await prisma.project.findUnique({ where: { id: issue.crawl.projectId } });
  if (!project) return fail("NOT_FOUND", 404);
  const ms = await prisma.membership.findMany({ where: { userId: u.id } });
  if (!ms.some((m) => m.organizationId === project.organizationId)) return fail("FORBIDDEN", 403);

  // check existing drafted action
  const existing = await prisma.aIAction.findFirst({ where: { issueId: issue.id, status: { in: ["drafted", "awaiting_approval"] } }, orderBy: { createdAt: "desc" } });
  if (existing) return ok(existing);

  const pages = await prisma.page.findMany({ where: { crawlId: issue.crawlId } });
  const parseJson = (s: string | null, fb: any) => { try { return s ? JSON.parse(s) : fb; } catch { return fb; } };
  const parsedPages = pages.map((p) => ({
    url: p.url, finalUrl: p.finalUrl || p.url, statusCode: p.statusCode || 0, contentType: p.contentType || "",
    title: p.title, metaDescription: p.metaDescription, canonical: p.canonical, h1: p.h1, h1Count: p.h1 ? 1 : 0,
    h2s: parseJson(p.h2s, [] as string[]), bodyText: (p.bodyText || "").slice(0, 4000), wordCount: p.wordCount,
    links: parseJson(p.links, [] as any[]), images: parseJson(p.images, [] as any[]), altMissingCount: p.altMissingCount,
    og: parseJson(p.og, {} as any), schemaTypes: parseJson(p.schemaTypes, [] as string[]),
    robotsDirectives: parseJson(p.robotsDirectives, { noindex: false, nofollow: false }), indexable: p.indexable, sizeBytes: p.sizeBytes, loadMs: p.loadMs, depth: p.depth,
  }));
  let affected: string[] = [];
  try { affected = JSON.parse(issue.affectedUrls); } catch {}
  const { fix, usage } = await fixGeneratorAgent(
    { type: issue.type, severity: issue.severity as any, title: issue.title, whatWrong: issue.whatWrong, whyMatters: issue.whyMatters, recommendation: issue.recommendation, impact: issue.impact, difficulty: issue.difficulty as any, affectedUrls: affected },
    parsedPages as any
  );
  if (!fix) return fail("No automatable fix for this issue type yet. Follow the recommendation manually.", 422);
  const action = await prisma.aIAction.create({
    data: {
      crawlId: issue.crawlId, issueId: issue.id, kind: fix.kind,
      status: "awaiting_approval", currentValue: fix.current, proposedValue: fix.proposed,
      reason: fix.reason, payload: JSON.stringify({ issueType: issue.type, urls: affected.slice(0, 5) }),
    },
  });
  await prisma.agentRun.create({
    data: { projectId: project.id, crawlId: issue.crawlId, agent: "fix_generator", input: JSON.stringify({ issue: issue.type, urls: affected.slice(0, 3) }).slice(0, 2000), output: JSON.stringify({ fix: fix.kind, model: usage.model }).slice(0, 2000), tokensUsed: usage.tokens, costUsd: usage.cost, durationMs: (usage as any).durationMs ?? 0, status: "completed" },
  });
  await prisma.auditLog.create({ data: { userId: u.id, action: "fix.generate", entity: "issue", entityId: issue.id } });
  return ok(action, 201);
}
