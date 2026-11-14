"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button, LoadingState, EmptyState, toast } from "@/components/ui";
export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  async function loadSchedules(id: string) {
    const result = await fetch(`/api/projects/${id}/schedules`).then((r) => r.json());
    if (result.ok) setSchedules(result.data.schedules);
  }
  useEffect(() => {
    Promise.all([fetch("/api/reports").then((r) => r.json()), fetch("/api/projects").then((r) => r.json()), fetch("/api/account").then((r) => r.json())])
      .then(async ([r, p, a]) => { if (r.ok) setReports(r.data); if (a.ok) setAccount(a.data); if (p.ok) { setProjects(p.data); if (p.data[0]) await loadSchedules(p.data[0].id); } })
      .catch(() => toast("Could not load reports", "Please refresh to try again.")).finally(() => setLoading(false));
  }, []);
  async function addSchedule() {
    const me = await fetch("/api/auth/me").then((r) => r.json());
    const project = projects[0]; if (!project || !me.data?.user) return;
    const result = await fetch(`/api/projects/${project.id}/schedules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: me.data.user.email, frequency: "weekly" }) }).then((r) => r.json());
    if (result.ok) { await loadSchedules(project.id); toast("Weekly report enabled", "Only newly completed audits will be emailed."); }
    else toast("Could not enable reports", result.error);
  }
  async function removeSchedule(id: string) {
    const project = projects[0]; if (!project) return;
    const result = await fetch(`/api/projects/${project.id}/schedules?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (result.ok) await loadSchedules(project.id); else toast("Could not remove schedule", result.error);
  }
  return <Shell><h1 className="page-title">Reports</h1><p className="body mt-1">Audit snapshots, checked pages, and practical next steps.</p>
    {loading ? <LoadingState lines={5} /> : <>
      <section className="card mt-5 p-5"><h2 className="section-title">Weekly email reports</h2><p className="body mt-1">Paid pilot accounts can receive fresh audit reports at their verified account email. Enable weekly audits in your website’s Monitoring tab.</p>
        {schedules.map((schedule) => <div key={schedule.id} className="mt-3 flex items-center gap-3 text-sm"><span>{schedule.email} · {schedule.frequency}</span><Button size="sm" variant="ghost" onClick={() => removeSchedule(schedule.id)}>Stop reports</Button></div>)}
        {!schedules.length && <Button className="mt-3" size="sm" disabled={account?.status !== "active" || !projects.length} onClick={addSchedule}>Enable weekly email</Button>}
      </section>
      {!!reports.length && <Button className="mt-4 print:hidden" size="sm" variant="secondary" onClick={() => window.print()}>Print / save PDF</Button>}
      {reports.map((report) => <article key={report.id} className="card mt-4 p-6"><h2 className="section-title">{report.projectName}</h2><p className="body mt-1">{new Date(report.createdAt).toLocaleDateString()} · {report.websiteUrl}</p>
        <p className="mt-3 text-xl font-semibold">{report.legacy ? "Legacy audit — rescan to update" : report.score !== null ? `Health: ${report.score}/100` : "Health score unavailable"}</p>
        {report.coverage && <p className="body mt-2">{report.coverage.audited} pages audited of {report.coverage.attempted} attempted URLs{report.coverage.partial ? " · incomplete coverage" : ""}.</p>}
        <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-slate-700">{report.markdown}</pre><Link className="mt-3 inline-block text-sm underline" href={`/projects/${report.projectId}`}>Open source audit</Link>
      </article>)}
      {!reports.length && <div className="mt-5"><EmptyState title="No completed reports yet" body="Your first report appears after a successful audit." /></div>}
    </>}
  </Shell>;
}
