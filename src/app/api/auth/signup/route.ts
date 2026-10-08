import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const SignupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  name: z.string().max(100).optional(),
  orgName: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit("signup:" + clientIp(req), 10, 60_000);
  if (!rl.ok) return fail("Too many attempts, try again shortly", 429);
  const body = await req.json().catch(() => ({}));
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid input: " + parsed.error.issues[0]?.message, 400);
  const { email, password, name, orgName } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return fail("An account with this email already exists", 409);
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, passwordHash },
  });
  const org = await prisma.organization.create({ data: { name: orgName || `${email.split("@")[0]}'s business` } });
  await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, role: "owner" } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "user.signup", entity: "user", entityId: user.id } });
  await createSession(user.id);
  return ok({ id: user.id, email: user.email, name: user.name });
}
