import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { adapterStatus } from "@/lib/cms";
import { z } from "zod";

const CmsSchema = z.object({
  cmsAdapter: z.enum(["auto", "manual", "webhook", "wordpress"]).optional(),
  cmsWebhookUrl: z.string().max(2000).nullable().optional(),
  cmsWebhookSecret: z.string().max(500).nullable().optional(),
});

function redact(project: any) {
  return {
    cmsAdapter: project.cmsAdapter || "auto",
    cmsWebhookUrl: project.cmsWebhookUrl || "",
    hasSecret: !!project.cmsWebhookSecret,
  };
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || (u.protocol === "http:" && /localhost|127\.0\.0\.1/.test(u.hostname));
  } catch {
    return false;
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(u.id, params.id);
    return ok({ cms: redact(project), status: adapterStatus(project as any) });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const body = await req.json().catch(() => ({}));
    const parsed = CmsSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    const { cmsAdapter, cmsWebhookUrl, cmsWebhookSecret } = parsed.data;

    if (cmsWebhookUrl && !isHttpsUrl(cmsWebhookUrl)) {
      return fail("Webhook must be an https:// URL (http allowed only for localhost testing).", 400);
    }
    if (cmsAdapter === "webhook" && !cmsWebhookUrl) {
      const current = await prisma.project.findUnique({ where: { id: params.id } });
      if (!(current as any)?.cmsWebhookUrl) return fail("Set a webhook URL to use the webhook adapter.", 400);
    }

    const data: any = {};
    if (cmsAdapter !== undefined) data.cmsAdapter = cmsAdapter === "auto" ? null : cmsAdapter;
    if (cmsWebhookUrl !== undefined) data.cmsWebhookUrl = cmsWebhookUrl || null;
    // secret: null/"" clears, undefined leaves alone, value sets
    if (cmsWebhookSecret !== undefined) data.cmsWebhookSecret = cmsWebhookSecret || null;

    const updated = await prisma.project.update({ where: { id: params.id }, data });
    await prisma.auditLog.create({
      data: { userId: u.id, action: "project.cms_update", entity: "project", entityId: params.id, meta: JSON.stringify({ adapter: updated.cmsAdapter || "auto", hasWebhook: !!(updated as any).cmsWebhookUrl }) },
    });
    return ok({ cms: redact(updated), status: adapterStatus(updated as any) });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
