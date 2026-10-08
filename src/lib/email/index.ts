/** Report emails: Resend when configured, honest log-only mode otherwise. */

export interface ReportEmailInput {
  to: string;
  projectName: string;
  websiteUrl: string;
  score: number | null;
  markdown: string;
  whiteLabel: boolean;
  agencyName?: string | null;
  reportDate: Date;
}

export function buildReportHtml(r: ReportEmailInput): string {
  const brand = r.whiteLabel ? (r.agencyName || "Your Agency") : "SEO Agent";
  const preheader = r.score != null ? `SEO health ${r.score}/100 for ${r.projectName}` : `SEO report for ${r.projectName}`;
  const body = (r.markdown || "No report yet.")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .split("\n").map((l) => {
      if (l.startsWith("# ")) return `<h1>${l.slice(2)}</h1>`;
      if (l.startsWith("## ")) return `<h2>${l.slice(3)}</h2>`;
      if (l.startsWith("- ")) return `<li>${l.slice(2)}</li>`;
      if (!l.trim()) return "";
      return `<p>${l}</p>`;
    }).join("\n");
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
<p style="color:#64748b;font-size:13px">${preheader}</p>
<p style="font-size:13px;color:#64748b">Prepared by ${brand} · ${r.reportDate.toLocaleDateString()} · <a href="${r.websiteUrl}">${r.websiteUrl}</a></p>
${r.score != null ? `<p style="font-size:32px;font-weight:700">${r.score}<span style="font-size:14px;color:#64748b">/100</span></p>` : ""}
${body}
<hr/><p style="font-size:12px;color:#94a3b8">${r.whiteLabel ? `Confidential — ${brand}` : "Evidence-backed, never invented. Reply to discuss next actions."}</p>
</body></html>`;
}

async function deliver(to: string, subject: string, html: string, brand: string): Promise<{ sent: boolean; mode: "resend" | "log"; id?: string; message: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "reports@seo-agent.app";
  if (!key) {
    console.log(`[email:log] to=${to} subject=${subject} brand=${brand}`);
    return { sent: false, mode: "log", message: "Email provider not configured (RESEND_API_KEY). Logged only — set RESEND_API_KEY to actually send." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { sent: false, mode: "resend", message: `Resend returned ${res.status}: ${t.slice(0, 300)}` };
    }
    const j = await res.json().catch(() => ({}));
    return { sent: true, mode: "resend", id: j.id, message: "Sent via Resend." };
  } catch (e: any) {
    return { sent: false, mode: "resend", message: `Send failed: ${e?.message || e}` };
  }
}

export async function sendReportEmail(r: ReportEmailInput): Promise<{ sent: boolean; mode: "resend" | "log"; id?: string; message: string }> {
  const html = buildReportHtml(r);
  const subject = r.score != null
    ? `SEO report: ${r.projectName} is ${r.score}/100`
    : `SEO report: ${r.projectName}`;
  return deliver(r.to, subject, html, r.whiteLabel ? r.agencyName || "agency" : "SEO Agent");
}

export interface AlertEmailInput {
  to: string;
  projectName: string;
  websiteUrl: string;
  projectId: string;
  kind: "critical" | "score_drop" | "crawl_failed";
  headline: string;
  details: string[];
  score: number | null;
  prevScore: number | null;
  whiteLabel: boolean;
  agencyName?: string | null;
}

export function buildAlertHtml(a: AlertEmailInput): string {
  const brand = a.whiteLabel ? (a.agencyName || "Your Agency") : "SEO Agent";
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const auditUrl = `${appUrl}/projects/${a.projectId}`;
  const items = a.details.slice(0, 6).map((d) => `<li>${d.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</li>`).join("");
  const scoreLine = a.prevScore != null && a.score != null
    ? `<p>Health: <b>${a.prevScore} → ${a.score}</b></p>`
    : a.score != null ? `<p>Health: <b>${a.score}/100</b></p>` : "";
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
<p style="font-size:13px;color:#b45309;font-weight:600">SEO alert · ${a.projectName}</p>
<h1 style="font-size:22px">${a.headline.replace(/</g, "&lt;")}</h1>
<p style="font-size:13px;color:#64748b">${a.websiteUrl} · Prepared by ${brand}</p>
${scoreLine}
<ul>${items}</ul>
<p><a href="${auditUrl}">Open the audit →</a></p>
<hr/><p style="font-size:12px;color:#94a3b8">${a.whiteLabel ? `Confidential — ${brand}` : "You get this because alerts are on for this site. Turn off anytime in CMS → Alerts."}</p>
</body></html>`;
}

export async function sendAlertEmail(a: AlertEmailInput) {
  const subject = `SEO alert: ${a.headline} (${a.projectName})`.slice(0, 120);
  return deliver(a.to, subject, buildAlertHtml(a), a.whiteLabel ? a.agencyName || "agency" : "SEO Agent");
}

export function isDue(schedule: { frequency: string; lastSentAt: Date | null }, now = new Date()): boolean {
  if (!schedule.lastSentAt) return true;
  const days = schedule.frequency === "monthly" ? 30 : 7;
  return now.getTime() - new Date(schedule.lastSentAt).getTime() >= days * 24 * 3600 * 1000;
}
