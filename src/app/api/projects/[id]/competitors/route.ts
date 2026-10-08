import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { normalizeUrl } from "@/lib/url-validation";
import { ok, fail, toStatus } from "@/lib/api";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const body = await req.json().catch(() => ({}));
    const url = normalizeUrl(String(body.url || ""));
    const c = await prisma.competitor.create({ data: { projectId: params.id, url, label: body.label } });
    return ok(c, 201);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
