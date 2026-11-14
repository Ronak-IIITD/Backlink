import { getSessionUser } from "@/lib/auth";
import { accessibleAction } from "@/lib/pilot/actions";
import { ok, fail, apiError } from "@/lib/api";
export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return fail("UNAUTHORIZED", 401);
    await accessibleAction((await props.params).id, user.id);
    return fail("Publishing integrations are disabled during the pilot. Copy the approved fix into your website, then report the update.", 403, { code: "MANUAL_HANDOFF_ONLY" });
  } catch (error) { return apiError(error); }
}
export async function GET() { return ok({ adapters: { active: "manual", manual: { configured: true } }, rule: "Pilot fixes are applied manually and verified by rescan." }); }
