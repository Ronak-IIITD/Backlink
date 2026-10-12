import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({
    token: z.string().min(32).max(128),
    password: z.string().min(12).max(100),
  }).safeParse(body);
  if (!parsed.success) return fail("Use a valid reset link and a password with at least 12 characters.", 400);

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.expiresAt <= new Date()) return fail("This reset link is invalid or expired.", 400);

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.deleteMany({
        where: { tokenHash, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new Error("RESET_TOKEN_INVALID");
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
      await tx.auditLog.create({
        data: { userId: reset.userId, action: "user.password_reset", entity: "user", entityId: reset.userId },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESET_TOKEN_INVALID") {
      return fail("This reset link is invalid or expired.", 400);
    }
    throw error;
  }
  return ok({ message: "Password updated. Please log in with your new password." });
}
