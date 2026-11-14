import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { transaction, requirePaid, PilotError } from "@/lib/pilot/access";
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(); if (!user) return fail("UNAUTHORIZED", 401);
    const { id } = await props.params; await assertProjectAccess(user.id, id);
    return ok({ schedules: await prisma.reportSchedule.findMany({ where: { projectId: id }, take: 20 }), emailMode: process.env.RESEND_API_KEY ? "resend" : "log" });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(); if (!user) return fail("UNAUTHORIZED", 401);
    const project = await assertProjectAccess(user.id, (await props.params).id);
    const parsed = z.object({ email: z.string().email(), frequency: z.enum(["weekly", "monthly"]).default("weekly") }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || parsed.data.email.toLowerCase().trim() !== user.email) return fail("Reports can only be sent to your verified account email.", 400);
    const row = await transaction(async (tx) => {
      await requirePaid(tx, project.organizationId);
      if (await tx.reportSchedule.count({ where: { projectId: project.id } })) throw new PilotError("SCHEDULE_LIMIT_REACHED", "Your pilot includes one report schedule. Remove the current schedule to replace it.", 409);
      return tx.reportSchedule.create({ data: { projectId: project.id, email: user.email, frequency: parsed.data.frequency, whiteLabel: false } });
    });
    return ok(row, 201);
  } catch (error) { return apiError(error); }
}
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser(); if (!user) return fail("UNAUTHORIZED", 401);
    const { id } = await props.params; await assertProjectAccess(user.id, id);
    const scheduleId = new URL(req.url).searchParams.get("id");
    if (!scheduleId) return fail("Missing schedule ID", 400);
    const deleted = await prisma.reportSchedule.deleteMany({ where: { id: scheduleId, projectId: id } });
    return deleted.count ? ok({ deleted: true }) : fail("NOT_FOUND", 404);
  } catch (error) { return apiError(error); }
}
