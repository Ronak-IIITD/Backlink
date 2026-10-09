import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", 401);
  const crawl = await prisma.crawl.findUnique({ where: { id: params.id } });
  if (!crawl) return fail("NOT_FOUND", 404);
  // verify access via project
  const project = await prisma.project.findUnique({ where: { id: crawl.projectId } });
  if (!project) return fail("NOT_FOUND", 404);
  const ms = await prisma.membership.findMany({ where: { userId: u.id } });
  if (!ms.some((m) => m.organizationId === project.organizationId)) return fail("FORBIDDEN", 403);
  let progress: any = null;
  try { progress = crawl.progress ? JSON.parse(crawl.progress) : null; } catch {}
  return ok({ ...crawl, progress });
}
