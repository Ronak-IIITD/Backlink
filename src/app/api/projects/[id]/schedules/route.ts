import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, toStatus } from "@/lib/api";
import { z } from "zod";

const CreateSchema = z.object({
  email: z.string().email().max(320),
  frequency: z.enum(["weekly", "monthly"]).default("weekly"),
  whiteLabel: z.boolean().default(false),
  agencyName: z.string().max(120).nullable().optional(),
});

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const rows = await prisma.reportSchedule.findMany({ where: { projectId: params.id }, orderBy: { createdAt: "desc" }, take: 20 });
    const emailMode = process.env.RESEND_API_KEY ? "resend" : "log";
    return ok({ schedules: rows, emailMode });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
    const row = await prisma.reportSchedule.create({
      data: {
        projectId: params.id,
        email: parsed.data.email.toLowerCase().trim(),
        frequency: parsed.data.frequency,
        whiteLabel: parsed.data.whiteLabel,
        agencyName: parsed.data.agencyName?.trim() || null,
      },
    });
    await prisma.auditLog.create({ data: { userId: u.id, action: "schedule.create", entity: "project", entityId: params.id, meta: JSON.stringify({ email: row.email, frequency: row.frequency }) } });
    return ok(row, 201);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(u.id, params.id);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("Missing ?id=", 400);
    const row = await prisma.reportSchedule.findUnique({ where: { id } });
    if (!row || row.projectId !== params.id) return fail("NOT_FOUND", 404);
    await prisma.reportSchedule.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
