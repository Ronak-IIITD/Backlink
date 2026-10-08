import type { ApplyRequest, ApplyResult } from "./types";
import { manualAdapter, webhookAdapter, wordpressAdapter } from "./adapters";

export type { ApplyRequest, ApplyResult };

export interface ProjectCmsConfig {
  cmsAdapter?: string | null;
  cmsWebhookUrl?: string | null;
  cmsWebhookSecret?: string | null;
}

/** Adapter selection: per-project override wins, else CMS_ADAPTER env, else auto. */
export function getAdapter(project?: ProjectCmsConfig | null) {
  const want = (project?.cmsAdapter || process.env.CMS_ADAPTER || "").toLowerCase();
  if (want === "wordpress") return wordpressAdapter;
  if (want === "webhook") return webhookAdapter;
  if (want === "manual") return manualAdapter;
  // auto: prefer configured real adapter, fall back to manual (never fake success)
  if (project?.cmsWebhookUrl || webhookAdapter.isConfigured()) return webhookAdapter;
  if (wordpressAdapter.isConfigured()) return wordpressAdapter;
  return manualAdapter;
}

export function adapterStatus(project?: ProjectCmsConfig | null) {
  const active = getAdapter(project).name;
  const projectWebhook = project?.cmsWebhookUrl || null;
  return {
    active,
    source: project?.cmsAdapter || projectWebhook ? "project" : "env",
    project: project ? { adapter: project.cmsAdapter || null, hasWebhook: !!projectWebhook, hasSecret: !!project?.cmsWebhookSecret } : null,
    webhook: { configured: !!(projectWebhook || webhookAdapter.isConfigured()), hint: projectWebhook ? null : webhookAdapter.whyNotConfigured() },
    wordpress: { configured: wordpressAdapter.isConfigured(), hint: wordpressAdapter.whyNotConfigured() },
    manual: { configured: true, hint: null },
  };
}

export async function applyAction(req: ApplyRequest, project?: ProjectCmsConfig | null): Promise<ApplyResult> {
  const adapter = getAdapter(project);
  // Per-project webhook override: POST directly to the client's endpoint
  if (adapter.name === "webhook" && project?.cmsWebhookUrl) {
    const url = project.cmsWebhookUrl;
    const secret = project.cmsWebhookSecret || process.env.CMS_WEBHOOK_SECRET;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...(secret ? { "X-CMS-Secret": secret } : {}) },
        body: JSON.stringify({
          actionId: req.actionId,
          projectId: req.projectId,
          kind: req.kind,
          currentValue: req.currentValue,
          proposedValue: req.proposedValue,
          targetUrls: req.targetUrls,
          appliedAt: new Date().toISOString(),
        }),
      });
      clearTimeout(t);
      if (!res.ok) {
        return { applied: false, adapter: "webhook(project)", message: `Client webhook returned ${res.status}. Nothing changed — safe to retry.` };
      }
      return { applied: true, adapter: "webhook(project)", message: "Sent to client webhook and acknowledged. Verify live, then rescan." };
    } catch (e: any) {
      return { applied: false, adapter: "webhook(project)", message: `Client webhook failed: ${e?.message || "fetch error"}. Nothing changed.` };
    }
  }
  return adapter.apply(req);
}
