import type { ApplyRequest, ApplyResult } from "./types";
import { manualAdapter } from "./adapters";
export type { ApplyRequest, ApplyResult };
export interface ProjectCmsConfig { cmsAdapter?: string | null; cmsWebhookUrl?: string | null; cmsWebhookSecret?: string | null }
export function getAdapter(_project?: ProjectCmsConfig | null) { return manualAdapter; }
export function adapterStatus(_project?: ProjectCmsConfig | null) {
  return { active: "manual", source: "pilot", manual: { configured: true, hint: null },
    webhook: { configured: false, hint: "Disabled during the pilot" }, wordpress: { configured: false, hint: "Disabled during the pilot" } };
}
export async function applyAction(req: ApplyRequest, _project?: ProjectCmsConfig | null): Promise<ApplyResult> { return manualAdapter.apply(req); }
