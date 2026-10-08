import type { ApplyRequest, ApplyResult, CmsAdapter } from "./types";

/** Manual adapter — always available. Returns copy-paste instructions, never pretends to apply. */
export const manualAdapter: CmsAdapter = {
  name: "manual",
  isConfigured: () => true,
  whyNotConfigured: () => null,
  async apply(req: ApplyRequest): Promise<ApplyResult> {
    const where = req.targetUrls[0] || req.websiteUrl;
    return {
      applied: false,
      adapter: "manual",
      message: `Copy-paste required. Open ${where} in your CMS and replace with the approved value.`,
      detail: req.proposedValue.slice(0, 500),
    };
  },
};

/** Generic webhook adapter — POSTs structured change to your automation (Zapier/Make/Webflow Logic/WP webhook). */
export const webhookAdapter: CmsAdapter = {
  name: "webhook",
  isConfigured: () => !!process.env.CMS_WEBHOOK_URL,
  whyNotConfigured: () => (process.env.CMS_WEBHOOK_URL ? null : "Set CMS_WEBHOOK_URL to your automation endpoint to enable auto-apply."),
  async apply(req: ApplyRequest): Promise<ApplyResult> {
    const url = process.env.CMS_WEBHOOK_URL;
    if (!url) return { applied: false, adapter: "webhook", message: "Webhook not configured. Set CMS_WEBHOOK_URL." };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...(process.env.CMS_WEBHOOK_SECRET ? { "X-CMS-Secret": process.env.CMS_WEBHOOK_SECRET } : {}) },
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
        return { applied: false, adapter: "webhook", message: `Webhook returned ${res.status}. Change NOT applied — still approved, safe to retry.`, detail: await res.text().catch(() => "").then((s) => s.slice(0, 500)) };
      }
      return { applied: true, adapter: "webhook", message: "Sent to CMS webhook and acknowledged (2xx). Verify on your live URL, then rescan." };
    } catch (e: any) {
      return { applied: false, adapter: "webhook", message: `Webhook failed: ${e?.message || "fetch error"}. Nothing changed.` };
    }
  },
};

/**
 * WordPress adapter (MVP): resolves target URL slug → WP post via /wp-json/wp/v2/search,
 * then patches title/meta. Requires WP_URL + WP_USER + WP_APP_PASSWORD.
 * Only handles title_fix/h1_fix directly; meta needs SEO plugin REST support so we return guidance otherwise.
 */
export const wordpressAdapter: CmsAdapter = {
  name: "wordpress",
  isConfigured: () => !!(process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD),
  whyNotConfigured: () => (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD ? null : "Set WP_URL, WP_USER, WP_APP_PASSWORD to enable WordPress auto-apply."),
  async apply(req: ApplyRequest): Promise<ApplyResult> {
    const base = (process.env.WP_URL || "").replace(/\/$/, "");
    const user = process.env.WP_USER || "";
    const pass = process.env.WP_APP_PASSWORD || "";
    if (!base || !user || !pass) return { applied: false, adapter: "wordpress", message: "WordPress not configured." };
    if (req.kind !== "title_fix" && req.kind !== "h1_fix") {
      return { applied: false, adapter: "wordpress", message: `WordPress MVP only auto-applies title/h1. Kind=${req.kind}: use webhook or copy-paste.` };
    }
    try {
      const auth = Buffer.from(`${user}:${pass}`).toString("base64");
      const target = req.targetUrls[0] || "";
      let slug = "";
      try { slug = new URL(target).pathname.split("/").filter(Boolean).pop() || ""; } catch {}
      const searchUrl = `${base}/wp-json/wp/v2/search?search=${encodeURIComponent(slug || req.proposedValue.slice(0, 30))}&per_page=5`;
      const found = await fetch(searchUrl, { headers: { Authorization: `Basic ${auth}` } }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const post = Array.isArray(found) ? found.find((p: any) => p.type === "post" || p.subtype === "page" || p.subtype === "post") || found[0] : null;
      if (!post?.id || !post?.subtype) {
        return { applied: false, adapter: "wordpress", message: "Could not map URL to a WordPress post. Check slug or use webhook adapter." };
      }
      const patchUrl = `${base}/wp-json/wp/v2/${post.subtype === "page" ? "pages" : "posts"}/${post.id}`;
      const body: any = req.kind === "title_fix" ? { title: req.proposedValue } : { content: undefined };
      if (req.kind === "h1_fix") {
        return { applied: false, adapter: "wordpress", message: "H1 lives in post content — review in WP editor to avoid breaking layout. Title auto-apply supported; H1 stays manual in MVP." };
      }
      const res = await fetch(patchUrl, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { applied: false, adapter: "wordpress", message: `WordPress returned ${res.status}. Nothing changed.` };
      return { applied: true, adapter: "wordpress", message: `Updated ${post.subtype} #${post.id} title in WordPress. Verify live, then rescan.` };
    } catch (e: any) {
      return { applied: false, adapter: "wordpress", message: `WordPress apply failed: ${e?.message || e}. Nothing changed.` };
    }
  },
};
