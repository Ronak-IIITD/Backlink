"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, FileText, Clock, CheckCircle2, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Stagger, StaggerItem, Reveal, AnimatedNumber, AnimatedScoreRing } from "@/components/motion";
import { EmptyState, LoadingState, Badge } from "@/components/ui";

type ProjectSummary = {
  id: string; name: string; websiteUrl: string; score: number | null;
  reportDate: string | null; criticalCount: number; highCount: number;
  pendingApprovals: number; dueSchedules: number; firingAlerts: number;
  autoRescan: string; lastAutoCrawlAt: string | null; latestCrawlStatus: string;
};

type Totals = { projects: number; critical: number; high: number; dueReports: number; firingAlerts: number; pendingApprovals: number };

export default function AgencyDashboard() {
  const [data, setData] = useState<{ projects: ProjectSummary[]; totals: Totals } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agency/overview").then((r) => r.json()).then((j) => {
      if (j.ok) setData(j.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Shell><h1 className="page-title">Agency dashboard</h1><p className="body mt-1">Loading all clients…</p><div className="mt-5"><LoadingState lines={5} /></div></Shell>;

  if (!data || !data.projects.length) {
    return (
      <Shell>
        <h1 className="page-title">Agency dashboard</h1>
        <p className="body mt-1">All your clients in one view — health, due reports, alerts, approvals.</p>
        <div className="mt-6">
          <EmptyState
            title="No sites in this organization"
            body="Create your first project to start managing clients."
            action={<Link href="/projects" className="btn btn-primary btn-md">Analyze a website</Link>}
          />
        </div>
      </Shell>
    );
  }

  const { projects, totals } = data;

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="page-title">Agency dashboard</h1>
        <p className="body mt-1">{totals.projects} client{totals.projects !== 1 ? "s" : ""} — portfolio health at a glance.</p>
      </div>

      {/* Portfolio totals */}
      <Stagger gap={0.05} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} label="Clients" value={totals.projects} tone="emerald" />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="Critical issues" value={totals.critical} tone="red" />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="High priority" value={totals.high} tone="amber" />
        <StatCard icon={<FileText className="h-4 w-4 text-indigo-600" />} label="Reports due" value={totals.dueReports} tone="indigo" />
        <StatCard icon={<Bell className="h-4 w-4 text-orange-600" />} label="Alerts (24h)" value={totals.firingAlerts} tone="orange" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-slate-600" />} label="Awaiting approval" value={totals.pendingApprovals} tone="slate" />
      </Stagger>

      {/* Client table */}
      <Reveal delay={0.1} className="mt-6">
        <h2 className="section-title">All clients</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[13px] font-medium text-slate-500">
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Health</th>
                <th className="pb-2 pr-4">Critical</th>
                <th className="pb-2 pr-4">High</th>
                <th className="pb-2 pr-4">Approvals</th>
                <th className="pb-2 pr-4">Reports due</th>
                <th className="pb-2 pr-4">Alerts</th>
                <th className="pb-2 pr-4">Auto-rescan</th>
                <th className="pb-2 pr-4">Last scan</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <Link href={`/projects/${p.id}`} className="font-semibold truncate block max-w-[200px]">{p.name}</Link>
                    <span className="mono text-[12px] text-slate-500 block truncate max-w-[200px]">{p.websiteUrl}</span>
                  </td>
                  <td className="py-3 pr-4">
                    {p.score != null ? (
                      <AnimatedScoreRing score={p.score} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={p.criticalCount > 0 ? "text-red-600 font-semibold" : "text-emerald-600"}>
                      <AnimatedNumber value={p.criticalCount} />
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={p.highCount > 0 ? "text-amber-600 font-semibold" : "text-emerald-600"}>
                      <AnimatedNumber value={p.highCount} />
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {p.pendingApprovals > 0 ? (
                      <Badge tone="next">{p.pendingApprovals}</Badge>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {p.dueSchedules > 0 ? (
                      <Badge tone="warning">{p.dueSchedules}</Badge>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {p.firingAlerts > 0 ? (
                      <Badge tone="warning">{p.firingAlerts}</Badge>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      p.autoRescan === "weekly" ? "bg-emerald-100 text-emerald-700" :
                      p.autoRescan === "monthly" ? "bg-indigo-100 text-indigo-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {p.autoRescan === "off" ? "Manual" : p.autoRescan}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[13px] text-slate-500">
                    {p.reportDate ? new Date(p.reportDate).toLocaleDateString() : p.latestCrawlStatus === "completed" ? "Scanned" : "Never"}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Link href={`/projects/${p.id}`} className="text-[13px] font-medium text-indigo-700 hover:text-indigo-900">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Shell>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "emerald" | "red" | "amber" | "indigo" | "orange" | "slate" }) {
  const colors = {
    emerald: "text-emerald-600 bg-emerald-50",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    indigo: "text-indigo-600 bg-indigo-50",
    orange: "text-orange-600 bg-orange-50",
    slate: "text-slate-600 bg-slate-100",
  };
  return (
    <div className={`card p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="mt-1 text-[28px] font-semibold tabular-nums">
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}