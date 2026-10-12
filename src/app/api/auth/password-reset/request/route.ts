import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const genericResponse = () => ok({ message: "If an account exists for that email, a reset link will arrive shortly." });

export async function POST(req: Request) {
  if (!rateLimit(`password-reset:${clientIp(req)}`, 5, 15 * 60_000).ok) {
    return fail("Too many requests. Try again later.", 429);
  }
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email().max(200) }).safeParse(body);
  if (!parsed.success) return fail("Enter a valid email address.", 400);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return genericResponse();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000) },
    }),
  ]);

  const appUrl = (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (!appUrl) {
    console.error("[auth] Password reset email not sent: APP_URL is not configured");
    return genericResponse();
  }
  const result = await sendPasswordResetEmail(user.email, `${appUrl}/reset-password?token=${encodeURIComponent(token)}`);
  if (!result.sent) console.error(`[auth] Password reset email was not sent (${result.mode}): ${result.message}`);
  return genericResponse();
}
