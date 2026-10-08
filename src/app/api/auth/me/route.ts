import { getSessionUser } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function GET() {
  const u = await getSessionUser();
  if (!u) return ok({ user: null });
  return ok({ user: { id: u.id, email: u.email, name: u.name } });
}
