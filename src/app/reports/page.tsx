"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Stagger, StaggerItem, Reveal, AnimatedScoreRing } from "@/components/motion";
import { Button, EmptyState, Field, Input, LoadingState, Select, toast } from "@/components/ui";

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [agency, setAgency] = useState("Your Agency");

  useEffect(() => {
    fetch("/api/reports").then((r) => r.json()).then((j) => {
      if (j.ok) setReports(Array.isArray(j.data) ? j.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Shell><h1 className="page-title">Reports</h1><p className="body mt-1">Loading reports…</p><div className="mt-5"><LoadingState lines={5} /></div></Shell>;

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="body mt-1">Snapshots of site health over time — evidence-backed, never invented.</p>
        </div>
        {reports.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-600">
              <input type="checkbox" checked={whiteLabel} onChange={(e) => setWhiteLabel(e.target.checked)} className="h-3.5 w-3.5 accent-slate-900" />
              White-label
            </label>
            <button onClick={() => window.print()} className="btn btn-secondary btn-sm">Print / PDF</button>
          </div>
        )}
      </div>
      {whiteLabel && reports.length > 0 && (
        <div className="mt-4 hidden items-center gap-2 print:flex">
          <span className="text-sm text-slate-500">Prepared by</span>
          <input value={agency} onChange={(e) => setAgency(e.target.value)} className="border-b border-slate-300 bg-transparent text-sm font-semibold outline-none print:border-0" aria-label="Agency name" />
        </div>
      )}
      <SchedulesPanel />
      <div className="mt-5 print:mt-2">
        {reports.length ? (
          <Stagger gap={0.07} className="space-y-4 print:space-y-3">
            {reports.map((report) => (
              <StaggerItem key={report.id}>
                <div className="card p-6 print:border-slate-300 print:shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="section-title">{report.projectName || "Site"} — {new Date(report.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</h2>
                      <div className="mono mt-1 truncate text-[13px] text-slate-500">{report.websiteUrl}</div>
                      {!whiteLabel && (
                        <div className="mt-1 text-[13px] text-slate-500">SEO Agent · evidence-backed</div>
                      )}
                      {whiteLabel && (
                        <div className="mt-1 text-[13px] text-slate-500">{agency} · confidential</div>
                      )}
                    </div>
                    <AnimatedScoreRing score={report.score ?? 0} />
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3 print:hidden">
                    <Link href={report.projectId ? `/projects/${report.projectId}` : "/projects"} className="text-[13px] font-medium text-indigo-700 transition-colors hover:text-indigo-900">View source audit →</Link>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal>
            <EmptyState
              title="No reports yet"
              body="Run your first audit — a report is generated from real crawl data once the scan completes."
              action={<Link href="/projects" className="btn btn-primary btn-md">Analyze my website</Link>}
            />
          </Reveal>
        )}
      </div>
    </Shell>
  );
}

function SchedulesPanel() {
  const [projects, setProjects] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  const [email, setEmail] = useState("");
  const [freq, setFreq] = useState("weekly");
  const [wl, setWl] = useState(true);
  const [agency, setAgency] = useState("Your Agency");
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState("log");
  const [busy, setBusy] = useState(false);

  async function loadSchedules(id: string) {
    if (!id) { setRows([]); return; }
    const j = await fetch(`/api/projects/${id}/schedules`).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setRows(j.data.schedules); setMode(j.data.emailMode); }
  }

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      if (j.ok && j.data[0]) {
        setProjects(j.data);
        setPid(j.data[0].id);
        loadSchedules(j.data[0].id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!pid || !email.trim()) { toast("Missing details", "Pick a site and enter a client email."); return; }
    setBusy(true);
    try {
      const j = await fetch(`/api/projects/${pid}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), frequency: freq, whiteLabel: wl, agencyName: agency.trim() || null }),
      }).then((r) => r.json());
      if (j.ok) { setEmail(""); loadSchedules(pid); toast("Schedule added", `${freq} report to ${j.email || email}.`); }
      else toast("Couldn't save", j.error);
    } finally { setBusy(false); }
  }

  async function sendNow(id: string) {
    const j = await fetch(`/api/projects/${pid}/schedules/${id}/send`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) toast(j.sent ? "Report sent" : "Logged, not sent", j.message);
    else toast("Couldn't send", j?.error || "try again");
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${pid}/schedules?id=${id}`, { method: "DELETE" }).catch(() => null);
    loadSchedules(pid);
  }

  return (
    <div className="card mt-5 p-5 print:hidden">
      <h2 className="section-title">Scheduled client emails {mode === "log" && <span className="font-normal text-slate-500">· log mode (set RESEND_API_KEY to send)</span>}</h2>
      <p className="body mt-1">White-label reports emailed weekly or monthly per site. Cron <span className="mono">POST /api/cron/reports</span> sends what&apos;s due.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
        <Field label="Site">
          <Select value={pid} onChange={(e) => { setPid(e.target.value); loadSchedules(e.target.value); }} aria-label="Site">
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Client email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" type="email" />
        </Field>
        <Field label="Frequency">
          <Select value={freq} onChange={(e) => setFreq(e.target.value)} aria-label="Frequency">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
            <input type="checkbox" checked={wl} onChange={(e) => setWl(e.target.checked)} className="h-3.5 w-3.5 accent-slate-900" /> White-label
          </label>
          <Button size="sm" loading={busy} onClick={create}>Add</Button>
        </div>
      </div>
      {wl && (
        <div className="mt-3 max-w-[280px]">
          <Field label="Agency name on email">
            <Input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Your Agency" />
          </Field>
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1"><b>{r.email}</b> <span className="text-slate-500">· {r.frequency}{r.whiteLabel ? " · white-label" : ""}{r.lastSentAt ? ` · sent ${new Date(r.lastSentAt).toLocaleDateString()}` : " · never sent"}</span></span>
              <Button size="sm" variant="secondary" onClick={() => sendNow(r.id)}>Send now</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
