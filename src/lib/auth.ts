import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const COOKIE = "seo_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30d

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("SESSION_SECRET must be >= 32 chars");
  return new TextEncoder().encode(s);
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + MAX_AGE * 1000) },
  });
  const jwt = await new SignJWT({ sid: tokenHash, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return jwt;
}

export async function destroySession() {
  const c = cookies().get(COOKIE)?.value;
  if (c) {
    try {
      const { payload } = await jwtVerify(c, secret());
      const sid = (payload as any).sid as string;
      if (sid) await prisma.session.deleteMany({ where: { tokenHash: sid } });
    } catch {}
  }
  cookies().set(COOKIE, "", { maxAge: 0, path: "/" });
}

export async function getSessionUser() {
  const c = cookies().get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    const sid = (payload as any).sid as string;
    const uid = (payload as any).uid as string;
    if (!sid || !uid) return null;
    const sess = await prisma.session.findUnique({ where: { tokenHash: sid } });
    if (!sess || sess.expiresAt < new Date()) return null;
    const user = await prisma.user.findUnique({ where: { id: uid } });
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function getUserOrgIds(userId: string): Promise<string[]> {
  const ms = await prisma.membership.findMany({ where: { userId } });
  return ms.map((m) => m.organizationId);
}

export async function assertProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("NOT_FOUND");
  const orgIds = await getUserOrgIds(userId);
  if (!orgIds.includes(project.organizationId)) throw new Error("FORBIDDEN");
  return project;
}
