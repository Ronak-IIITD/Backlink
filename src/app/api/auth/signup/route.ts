import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { transaction, PilotError } from "@/lib/pilot/access";
import { invitationHash } from "@/lib/pilot/invitations";

const SignupSchema = z.object({
  email: z.string().email().max(200).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(12).max(100).refine((value) => Buffer.byteLength(value) <= 72, "Password must be at most 72 UTF-8 bytes"),
  token: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().max(100).optional(), orgName: z.string().max(120).optional(),
});
export async function POST(req: Request) {
  try {
    if (!(await rateLimit("signup:" + clientIp(req), 10, 60000)).ok) return fail("Too many attempts. Try again shortly.", 429);
    const parsed = SignupSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Use your invitation link and a password with at least 12 characters (maximum 72 UTF-8 bytes).", 400);
    const { email, password, token, name, orgName } = parsed.data;
    const passwordHash = await hashPassword(password);
    const user = await transaction(async (tx) => {
      const now = new Date();
      const consumed = await tx.invitation.updateMany({
        where: { tokenHash: invitationHash(token), email, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new PilotError("INVITATION_INVALID", "This invitation is invalid, expired, already used, or belongs to another email.");
      const account = await tx.user.create({ data: { email, passwordHash, name } });
      const org = await tx.organization.create({ data: { name: orgName || `${name || email.split("@")[0]}'s business` } });
      await tx.membership.create({ data: { userId: account.id, organizationId: org.id, role: "owner" } });
      await tx.accessPeriod.create({ data: { organizationId: org.id, kind: "trial", startsAt: now,
        endsAt: new Date(now.getTime() + 30 * 86400000), auditLimit: 1, draftLimit: 5 } });
      await tx.auditLog.create({ data: { userId: account.id, action: "user.signup", entity: "organization", entityId: org.id } });
      return account;
    });
    await createSession(user.id);
    return ok({ id: user.id, email: user.email, name: user.name }, 201);
  } catch (error: any) {
    if (error.code === "P2002") return fail("This account already exists. Sign in or reset your password.", 409);
    return apiError(error);
  }
}
