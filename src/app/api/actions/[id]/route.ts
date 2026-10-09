import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ok, fail } from "@/lib/api";

async function setStatus(id: string, userId: string, status: "approved" | "rejected" | "applied" | "failed", error?: string) {
  const action = await prisma.aIAction.findUnique({ where: { id } });
  if (!action) throw new Error("NOT_FOUND");
  const crawl = await prisma.crawl.findUnique({ where: { id: action.crawlId } });
  if (!crawl) throw new Error("NOT_FOUND");
  const project = await prisma.project.findUnique({ where: { id: crawl.projectId } });
  if (!project) throw new Error("NOT_FOUND");
  const ms = await prisma.membership.findMany({ where: { userId } });
  if (!ms.some((m) => m.organizationId === project.organizationId)) throw new Error("FORBIDDEN");
  const updated = await prisma.aIAction.update({
    where: { id },
    data: {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      ...(status === "approved" ? { } : {}),
      ...(status === "applied" ? { appliedAt: new Date() } : {}),
      ...(error ? { error } : {}),
    },
  });
  await prisma.auditLog.create({ data: { userId, action: `action.${status}`, entity: "aiaction", entityId: id } });
  return updated;
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await getSessionUser();
  if (!u) return fail("UNAUTHORIZED", 401);
  const url = new URL(req.url);
  // route: /api/actions/[id]/approve or /reject — detect via referrer? Instead handle both here via ?op=
  // We expose separate route files that import this; but keep generic: POST body {op}
  const body = await req.json().catch(() => ({}));
  const op = body.op || (url.pathname.endsWith("/approve") ? "approved" : url.pathname.endsWith("/reject") ? "rejected" : "approved");
  try {
    // MVP: approve → mark approved. Applied requires CMS integration (isolated interface).
    // We record approval; execution adapters (WordPress/Webflow/API) plug in here later.
    if (op === "approved") {
      const a = await setStatus(params.id, u.id, "approved");
      return ok({ ...a, note: "Approved. Connect your CMS to auto-apply, or copy the proposed value manually." });
    }
    if (op === "rejected") {
      const a = await setStatus(params.id, u.id, "rejected");
      return ok(a);
    }
    return fail("Invalid op", 400);
  } catch (e: any) {
    const m = String(e.message);
    if (m === "NOT_FOUND") return fail("NOT_FOUND", 404);
    if (m === "FORBIDDEN") return fail("FORBIDDEN", 403);
    return fail(m, 500);
  }
}
