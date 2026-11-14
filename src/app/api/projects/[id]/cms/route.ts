import { getSessionUser, assertProjectAccess } from "@/lib/auth";
import { ok, fail, apiError } from "@/lib/api";
export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    await assertProjectAccess(user.id, (await props.params).id);
    return ok({ cms: { cmsAdapter: "manual", hasSecret: false }, status: { active: "manual", manual: { configured: true } } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const response = await GET(req, props);
  if (response.status !== 200) return response;
  return fail("Publishing connections are disabled during the pilot. Apply approved instructions manually.", 403, { code: "MANUAL_HANDOFF_ONLY" });
}
