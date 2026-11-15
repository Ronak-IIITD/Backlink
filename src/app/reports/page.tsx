"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Mail, Printer } from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  LoadingState,
  EmptyState,
  ErrorState,
  toast,
} from "@/components/ui";
export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function read(url: string) {
    const response = await fetch(url);
    const result = await response.json();
    if (response.status === 401) window.location.assign("/login");
    if (!result.ok) throw new Error(result.error || "Couldn’t load reports");
    return result.data;
  }
  const load = useCallback(async () => {
    setError(false);
    try {
      const [r, p, a] = await Promise.all([
        read("/api/reports"),
        read("/api/projects"),
        read("/api/account"),
      ]);
      const schedule = p[0]
        ? await read(`/api/projects/${p[0].id}/schedules`)
        : { schedules: [] };
      setReports(r);
      setProjects(p);
      setAccount(a);
      setSchedules(schedule.schedules);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function updateSchedule(id?: string) {
    if (!projects[0] || busy) return;
    setBusy(true);
    try {
      const email = id ? null : (await read("/api/auth/me")).user.email;
      const result = await fetch(
        `/api/projects/${projects[0].id}/schedules${id ? `?id=${encodeURIComponent(id)}` : ""}`,
        {
          method: id ? "DELETE" : "POST",
          ...(!id
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, frequency: "weekly" }),
              }
            : {}),
        },
      ).then((r) => r.json());
      if (!result.ok) throw new Error(result.error);
      const refreshed = await read(`/api/projects/${projects[0].id}/schedules`);
      setSchedules(refreshed.schedules);
      toast(
        id ? "Weekly reports stopped" : "Weekly reports enabled",
        id ? undefined : "Only newly completed audits will be emailed.",
      );
    } catch (e) {
      toast(
        "Couldn’t update email reports",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-indigo-700">The bigger picture</p>
          <h1 className="page-title">Your progress, on paper.</h1>
          <p className="body mt-2">
            Audit snapshots, checked pages, and a practical path forward.
          </p>
        </div>
        {!!reports.length && !error && (
          <Button
            className="print-hidden"
            size="sm"
            variant="secondary"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" /> Print / save PDF
          </Button>
        )}
      </div>
      <div className="mt-8">
        {loading ? (
          <LoadingState lines={5} />
        ) : error ? (
          <ErrorState
            title="Reports couldn’t be loaded"
            body="Please retry to view your latest reports and email schedule."
            onRetry={load}
          />
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-5">
              {reports.map((report) => (
                <article key={report.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 p-6">
                    <div className="min-w-0">
                      <p className="eyebrow">
                        {new Date(report.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </p>
                      <h2 className="section-title mt-2">
                        {report.projectName}
                      </h2>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {report.websiteUrl}
                      </p>
                    </div>
                    <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
                      {report.legacy
                        ? "Rescan to update"
                        : typeof report.score === "number"
                          ? `${report.score} / 100`
                          : "Score unavailable"}
                    </span>
                  </div>
                  <div className="p-6">
                    {report.coverage && (
                      <p className="mb-5 text-xs leading-5 text-slate-500">
                        {report.coverage.audited} pages audited of{" "}
                        {report.coverage.attempted} attempted URLs
                        {report.coverage.partial
                          ? " · Incomplete coverage"
                          : ""}
                        .
                      </p>
                    )}
                    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-7 text-slate-700 [overflow-wrap:anywhere]">
                      {report.markdown}
                    </pre>
                    <Link
                      className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-indigo-700"
                      href={`/projects/${report.projectId}`}
                    >
                      Open source audit <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
              {!reports.length && (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="Your first report starts with an audit"
                  body="Once an audit finishes, you’ll find its checked pages, findings, and recommendations here."
                  action={
                    <Link href="/projects" className="btn btn-primary btn-md">
                      View your website
                    </Link>
                  }
                />
              )}
            </div>
            <aside className="print-hidden rounded-2xl border border-slate-200 bg-slate-100/60 p-6">
              <Mail className="h-6 w-6 text-indigo-700" strokeWidth={1.5} />
              <h2 className="section-title mt-5">A weekly perspective.</h2>
              <p className="body mt-3 text-[13px]">
                Receive fresh reports at your verified account email. Enable
                weekly audits in your website’s Monitoring tab.
              </p>
              <div className="mt-4">
                <Badge
                  tone={account?.status === "active" ? "completed" : "watch"}
                >
                  {account?.status === "active"
                    ? "Included in your plan"
                    : "Requires paid pilot access"}
                </Badge>
              </div>
              {schedules.map((s) => (
                <div key={s.id} className="mt-5 border-t border-slate-200 pt-4">
                  <p className="break-all text-xs font-medium">{s.email}</p>
                  <p className="mt-1 text-xs capitalize text-slate-500">
                    {s.frequency}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-3"
                    disabled={busy}
                    onClick={() => updateSchedule(s.id)}
                  >
                    Stop reports
                  </Button>
                </div>
              ))}
              {!schedules.length && (
                <Button
                  className="mt-5 w-full"
                  size="sm"
                  disabled={
                    account?.status !== "active" || !projects.length || busy
                  }
                  loading={busy}
                  onClick={() => updateSchedule()}
                >
                  Enable weekly email
                </Button>
              )}
              <p className="mt-5 text-[11px] leading-5 text-slate-500">
                Weekly audits count toward your plan’s audit allowance. Only
                new, completed audits are emailed.
              </p>
            </aside>
          </div>
        )}
      </div>
    </Shell>
  );
}
