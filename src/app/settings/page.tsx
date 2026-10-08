"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import { Badge, Breadcrumb, LoadingState } from "@/components/ui";

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
  { id: "sites", label: "Websites" },
  { id: "ai", label: "AI settings" },
  { id: "crawler", label: "Crawler" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
];

export default function Settings() {
  const [me, setMe] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [active, setActive] = useState("account");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setMe(j.data?.user)).catch(() => {});
    fetch("/api/projects").then((r) => r.json()).then((j) => { if (j.ok) setProjects(j.data); }).catch(() => {});
  }, []);

  return (
    <Shell>
      <Breadcrumb items={[{ label: "Settings" }]} />
      <h1 className="page-title mt-2">Settings</h1>
      <p className="body mt-1">Conventional, boring, predictable — as settings should be.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="h-fit space-y-0.5 md:sticky md:top-6" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id} onClick={() => { setActive(s.id); if (document.documentElement.classList.contains("lenis")) { window.dispatchEvent(new CustomEvent("lenis:scroll-to", { detail: { selector: `#s-${s.id}`, offset: -16 } })); } else { document.getElementById(`s-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}
              aria-current={active === s.id ? "true" : undefined}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${active === s.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          <Section id="account" title="Account" desc="Who's approving fixes.">
            {!me ? <LoadingState lines={2} /> : (
              <KV rows={[["Email", me.email], ["Name", me.name || "—"], ["User ID", me.id]]} />
            )}
          </Section>
          <Section id="workspace" title="Workspace" desc="One workspace per account in this MVP; organizations and roles are modeled in the database.">
            <KV rows={[["Sites", String(projects.length)], ["Isolation", "Per-organization project scoping on every API route"]]} />
          </Section>
          <Section id="sites" title="Websites" desc="Sites under management.">
            <div className="divide-y divide-slate-100">
              {projects.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><b>{p.name}</b> <span className="mono block truncate text-slate-500">{p.websiteUrl}</span></span>
                  <Badge tone={p.crawls?.[0]?.status === "completed" ? "completed" : "watch"}>{p.crawls?.[0]?.status || "never scanned"}</Badge>
                </div>
              ))}
              {!projects.length && <p className="body py-2">No sites yet.</p>}
            </div>
          </Section>
          <Section id="ai" title="AI settings" desc="Model behavior. Deterministic rules always run first; the LLM only interprets.">
            <KV rows={[
              ["Provider", "OpenAI-compatible chat completions"],
              ["Default model", process.env.NEXT_PUBLIC_AI || "gpt-4o-mini (OPENAI_MODEL)"],
              ["Fallback", "Deterministic templates when no key — $0 cost"],
              ["Cost tracking", "Tokens + USD logged per AgentRun"],
            ]} />
          </Section>
          <Section id="crawler" title="Crawler" desc="Same-domain, robots-respecting, rate-limited.">
            <KV rows={[
              ["Scope", "Same registrable domain only"],
              ["Limits", "30 pages · depth 3 · 12s timeout · 400ms pacing"],
              ["Tuning", "CRAWL_MAX_PAGES · CRAWL_MAX_DEPTH · CRAWL_TIMEOUT_MS · CRAWL_RATE_LIMIT_MS"],
            ]} />
          </Section>
          <Section id="notifications" title="Notifications" desc="Quiet by design.">
            <KV rows={[["Agent digests", "Off in MVP — queue is pull-based"], ["Failures", "Shown inline with safe retry"]]} />
          </Section>
          <Section id="security" title="Security" desc="Approval boundary is enforced.">
            <KV rows={[
              ["SSRF", "Scheme/host/port allowlists + DNS private-IP rejection"],
              ["Sessions", "httpOnly JWT + hashed DB sessions, 30-day expiry"],
              ["Audit trail", "Every create/scan/fix/approval in AuditLog"],
            ]} />
          </Section>
        </div>
      </div>
    </Shell>
  );
}

function Section({ id, title, desc, children }: { id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section id={`s-${id}`} className="card scroll-mt-6 p-5" aria-label={title}>
      <h2 className="section-title text-[15px]">{title}</h2>
      <p className="body mt-0.5">{desc}</p>
      <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>
    </section>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 py-2">
          <dt className="w-32 shrink-0 text-slate-500">{k}</dt>
          <dd className="min-w-0 flex-1 break-words font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
