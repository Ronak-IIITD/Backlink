import { getSessionUser } from "@/lib/auth";
import { pagesHandler } from "@/lib/handlers";
import { fail, toStatus } from "@/lib/api";

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const u = await getSessionUser();
    if (!u) return fail("UNAUTHORIZED", 401);
    return await pagesHandler(params.id, u.id);
  } catch (e: any) {
    return fail(e.message || "failed", toStatus(e));
  }
}
