import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { hashToken } from "@/lib/share";

async function resolveProject(raw: string) {
  const link = await prisma.shareLink.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!link) return null;
  if (link.expiresAt < new Date()) return null;
  const project = await prisma.project.findUnique({ where: { id: link.projectId } });
  if (!project) return null;
  return { link, project };
}

/** Public (no login): view approval queue via magic link. Never exposes secrets. */
export async function GET(_: Request, { params }: { params: { token: string } }) {
  const found = await resolveProject(params.token).catch(() => null);
  if (!found) return fail("Invalid or expired link.", 404);
  const { project } = found;
  const crawls = await prisma.crawl.findMany({ where: { projectId: project.id }, select: { id: true } });
  const ids = crawls.map((c) => c.id);
  const actions = ids.length
    ? await prisma.aIAction.findMany({ where: { crawlId: { in: ids }, status: { in: ["awaiting_approval", "approved", "applied"] } }, orderBy: { createdAt: "desc" }, take: 30 })
    : [];
  return ok({
    project: { name: project.name, websiteUrl: project.websiteUrl },
    actions: actions.map((a) => ({
      id: a.id, kind: a.kind, status: a.status,
      currentValue: a.currentValue, proposedValue: a.proposedValue, reason: a.reason,
    })),
  });
}
