"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ScanSearch } from "lucide-react";
import { Stagger, StaggerItem, Reveal, AnimatedNumber, AnimatedScoreRing } from "@/components/motion";
import { EmptyState, LoadingState } from "@/components/ui";

type Counts = { critical: number; high: number; opportunities: number };

export default function Dashboard() {
  const [pid, setPid] = useState<string | null>(null);
  const [pname, setPname] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [counts, setCounts] = useState<Counts>({ critical: 0, high: 0, opportunities: 0 });
  const [nextActions, setNextActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(async (j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      if (!j.data[0]) { setLoading(false); return; }
      const p = j.data[0];
      setPid(p.id); setPname(p.name);
      try {
        const d = await fetch(`/api/projects/${p.id}`).then((x) => x.json());
        if (d.ok) {
          setScore(d.data.score?.overall ?? null);
          const crawl = d.data.latestCrawl;
          if (crawl?.status === "completed") {
            const [i, r2] = await Promise.all([
              fetch(`/api/projects/${p.id}/issues`).then((x) => x.json()),
              fetch(`/api/projects/${p.id}/recommendations`).then((x) => x.json()),
            ]);
            if (i.ok) {
              const issues = i.data.issues || [];
              setCounts({
                critical: issues.filter((x: any) => x.severity === "critical").reduce((a: number, x: any) => a + (x.affectedCount || 1), 0),
                high: issues.filter((x: any) => x.severity === "high").reduce((a: number, x: any) => a + (x.affectedCount || 1), 0),
                opportunities: issues.filter((x: any) => x.severity === "medium" || x.severity === "low").length,
              });
            }
            if (r2.ok) setNextActions((r2.data.recommendations || []).slice(0, 4));
          }
        }
      } catch {}
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Shell><h1 className="page-title">Overview</h1><p className="body mt-1">Loading your workspace…</p><div className="mt-5"><LoadingState lines={5} /></div></Shell>;

  if (!pid) {
    return (
      <Shell>
        <h1 className="page-title">Overview</h1>
        <div className="mt-6">
          <EmptyState
            title="No sites yet"
            body="Add your first website and the agent will audit it, rank what matters, and draft fixes for your approval."
            action={<Link href="/projects" className="btn btn-primary btn-md">Analyze my website</Link>}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5">
        <h1 className="page-title">Overview</h1>
        <p className="body mt-1">{pname} — what needs you today, ranked by impact.</p>
      </div>

      {/* Health + counts: calm entrance, numbers settle into place */}
      <Stagger gap={0.06} className="grid gap-4 md:grid-cols-[300px_1fr]">
        <StaggerItem className="card flex items-center gap-4 p-5">
          <AnimatedScoreRing score={score ?? 0} />
          <div>
            <div className="eyebrow">SEO health</div>
            <div className="text-sm text-slate-600">Continuous monitoring</div>
            <Link href={`/projects/${pid}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-indigo-700 transition-colors hover:text-indigo-900">
              Open audit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </StaggerItem>
        <div className="grid gap-4 sm:grid-cols-3">
          <StaggerItem><StatCard icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="Critical" value={counts.critical} tone="red" href={`/projects/${pid}`} /></StaggerItem>
          <StaggerItem><StatCard icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="High priority" value={counts.high} tone="amber" href={`/projects/${pid}`} /></StaggerItem>
          <StaggerItem><StatCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Opportunities" value={counts.opportunities} tone="green" href="/content" /></StaggerItem>
        </div>
      </Stagger>

      {/* Next actions */}
      <Reveal delay={0.1} className="mt-6">
        <h2 className="section-title">Next actions</h2>
        {nextActions.length ? (
          <ol className="mt-3 space-y-2.5">
            {nextActions.map((r, i) => (
              <Reveal key={r.id} delay={0.15 + i * 0.06} y={10}>
                <Link href={`/projects/${pid}`} className="card card-hover flex items-start gap-3.5 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-semibold text-white">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{r.whatWrong}</span>
                    <span className="body mt-0.5 block">{r.whatToChange}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </Link>
              </Reveal>
            ))}
          </ol>
        ) : (
          <div className="card mt-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium"><ScanSearch className="h-4 w-4 text-slate-400" /> No scan results yet.</div>
            <p className="body mt-1">Run an audit on your site to fill this queue with ranked, evidence-backed actions.</p>
            <Link href={`/projects/${pid}`} className="btn btn-accent btn-sm mt-3">Open audit</Link>
          </div>
        )}
      </Reveal>
    </Shell>
  );
}

function StatCard({ icon, label, value, tone, href }: { icon: React.ReactNode; label: string; value: number; tone: "red" | "amber" | "green"; href: string }) {
  return (
    <Link href={href} className="card card-hover block p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
      </div>
      <div className={`mt-1 text-[28px] font-semibold tabular-nums tracking-tight ${tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-emerald-600"}`}>
        <AnimatedNumber value={value} />
      </div>
    </Link>
  );
}
