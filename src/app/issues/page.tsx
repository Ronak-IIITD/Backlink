"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Alert, Breadcrumb, EmptyState, LoadingState, SevBadge } from "@/components/ui";
import { Stagger, StaggerItem, AnimatedNumber } from "@/components/motion";
import { preferredProject } from "@/lib/project-selection";

export default function IssuesPage() {
  const [pid, setPid] = useState<string | null>(null);
  const [pname, setPname] = useState("");
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(async (j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      const project = preferredProject<any>(j.data);
      if (!project) { setLoading(false); return; }
      setPid(project.id); setPname(project.name);
      const k = await fetch(`/api/projects/${project.id}/issues`).then((x) => x.json());
      if (k.ok) setIssues(k.data.issues);
      else setErr(k.error);
      setLoading(false);
    }).catch(() => { setErr("Couldn't load issues."); setLoading(false); });
  }, []);

  const list = filter ? issues.filter((i) => i.severity === filter) : issues;
  const counts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
  };

  return (
    <Shell>
      <Breadcrumb items={[{ label: pname || "Site", href: pid ? `/projects/${pid}` : "/projects" }, { label: "Issues" }]} />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Issue queue</h1>
          <p className="body mt-1">
            {issues.length ? <><AnimatedNumber value={counts.critical} className="tabular-nums font-semibold text-slate-900" /> critical · <AnimatedNumber value={counts.high} className="tabular-nums font-semibold text-slate-900" /> high — ranked by impact, each with evidence and a drafted path forward.</> : "Ranked by impact, with evidence attached."}
          </p>
        </div>
        {pid && <Link href={`/projects/${pid}`} className="btn btn-secondary btn-sm">Open audit</Link>}
      </div>

      {loading ? <div className="mt-6"><LoadingState lines={5} label="Loading issues…" /></div>
        : err ? <div className="mt-6"><Alert tone="error">{err}</Alert></div>
        : !pid ? <div className="mt-6"><EmptyState title="No sites yet" body="Create a project and run an audit to fill this queue." action={<Link href="/projects" className="btn btn-primary btn-md">Analyze my website</Link>} /></div>
        : (
          <div className="mt-5">
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
              {["", "critical", "high", "medium", "low"].map((s) => (
                <button
                  key={s || "all"} onClick={() => setFilter(s)} aria-pressed={filter === s}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${filter === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                >
                  {s || "All"}
                </button>
              ))}
            </div>
            {!list.length ? (
              <EmptyState title={issues.length ? "Nothing at this severity" : "No issues found"} body={issues.length ? "Try another filter." : "A clean scan — rescan anytime after site changes."} />
            ) : (
              <Stagger as="ol" gap={0.05} className="space-y-2.5">
                {list.map((i: any) => (
                  <StaggerItem as="li" key={i.id}>
                    <Link href={`/projects/${pid}?issue=${i.id}`} className="card card-hover flex items-start gap-3.5 p-4">
                      <SevBadge sev={i.severity} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold">{i.title}</span>
                        <span className="body mt-0.5 line-clamp-2 block">{i.whyMatters}</span>
                        <span className="mt-1.5 block text-[13px] text-slate-400">{i.affectedCount} page{i.affectedCount === 1 ? "" : "s"} · Impact {i.impact} · {i.difficulty}</span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        )}
    </Shell>
  );
}
