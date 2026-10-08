import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { ok, fail } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rl = rateLimit("login:" + clientIp(req), 20, 60_000);
  if (!rl.ok) return fail("Too many attempts", 429);
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return fail("Invalid email/password", 400);
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail("Invalid email or password", 401);
  }
  await createSession(user.id);
  return ok({ id: user.id, email: user.email, name: user.name });
}
