"use client";
import { Shell } from "@/components/shell";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  FileCheck2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { AnimatedScoreRing } from "@/components/motion";
import { Badge, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { preferredProject } from "@/lib/project-selection";

type Workspace = {
  project: any;
  detail: any;
  issues: any[];
  recommendations: any[];
};
async function read(url: string) {
  const response = await fetch(url);
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Please log in to continue.");
  }
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new Error("Your workspace couldn’t be loaded. Please try again.");
  return result.data;
}
export default function Dashboard() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const projects = await read("/api/projects");
      const project = preferredProject<any>(projects);
      if (!project) {
        setWorkspace(null);
        return;
      }
      const detail = await read(`/api/projects/${project.id}`);
      let issues: any[] = [],
        recommendations: any[] = [];
      if (detail.latestCrawl?.status === "completed") {
        const [i, r] = await Promise.all([
          read(`/api/projects/${project.id}/issues`),
          read(`/api/projects/${project.id}/recommendations`),
        ]);
        issues = i.issues || [];
        recommendations = r.recommendations || [];
      }
      setWorkspace({ project, detail, issues, recommendations });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your workspace couldn’t be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const status = workspace?.detail.latestCrawl?.status;
  useEffect(() => {
    if (status !== "running" && status !== "queued") return;
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [status, load]);

  const header = (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2 text-indigo-700">
          Your website, moving forward
        </p>
        <h1 className="page-title">A little clarity. A next step.</h1>
        <p className="body mt-2">
          {workspace
            ? `${workspace.project.name} — here’s where to focus your attention.`
            : "A calmer way to look after your website’s SEO."}
        </p>
      </div>
      {workspace && (
        <Link
          href={`/projects/${workspace.project.id}`}
          className="btn btn-secondary btn-md"
        >
          View website audit <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
  if (loading)
    return (
      <Shell>
        {header}
        <LoadingState lines={6} label="Loading your workspace…" />
      </Shell>
    );
  if (error)
    return (
      <Shell>
        {header}
        <ErrorState
          title="Your overview is unavailable"
          body={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </Shell>
    );
  if (!workspace)
    return (
      <Shell>
        {header}
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl bg-forest p-7 text-white sm:p-10">
            <ScanLine className="h-8 w-8 text-[#c4d8bd]" strokeWidth={1.5} />
            <h2 className="display mt-8 text-4xl">
              Let’s get to know
              <br />
              your website.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-[#d2dfce]">
              Your first audit turns public page evidence into a clear list of
              improvements. Start with your URL. Add a little context if you
              like.
            </p>
            <Link
              href="/projects"
              className="btn btn-lg mt-8 bg-[#eff3df] text-forest hover:bg-white"
            >
              Add your website <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
          <Guide />
        </div>
      </Shell>
    );

  const { project, detail, issues, recommendations } = workspace;
  const completed = status === "completed";
  const score = detail.score?.overall;
  const coverage = detail.score?.coverage;
  const critical = issues.filter((i) => i.severity === "critical").length;
  const high = issues.filter((i) => i.severity === "high").length;
  const other = issues.filter((i) =>
    ["medium", "low"].includes(i.severity),
  ).length;
  return (
    <Shell>
      {header}
      {!completed ? (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="card p-8">
            <span className="mb-6 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-700">
              <ScanLine className="h-7 w-7" />
            </span>
            <Badge tone={status === "failed" ? "failed" : "running"}>
              {status || "Ready to begin"}
            </Badge>
            <h2 className="display mt-5 text-4xl">
              {status === "failed"
                ? "Let’s try that audit again."
                : status
                  ? "Your audit is taking shape."
                  : "A fresh perspective starts here."}
            </h2>
            <p className="body mt-4 max-w-md">
              {status === "failed"
                ? "The last audit couldn’t finish. Open your audit to see the details and try again."
                : status
                  ? "We’re checking your public pages. Results will appear when the audit is complete."
                  : "Run your first audit to see what’s working and where a change could help."}
            </p>
            <Link
              href={`/projects/${project.id}`}
              className="btn btn-primary btn-md mt-7"
            >
              {status ? "Open audit" : "Start your first audit"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
          <Guide />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-4 xl:gap-4">
            <section className="card col-span-3 flex items-center gap-4 p-5 xl:col-span-1">
              {typeof score === "number" ? (
                <AnimatedScoreRing score={score} />
              ) : (
                <span className="font-mono text-3xl text-slate-400">—</span>
              )}
              <div>
                <p className="eyebrow">SEO health</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {detail.legacyAudit
                    ? "Rescan to update this audit"
                    : "Latest audited sample"}
                </p>
              </div>
            </section>
            {[
              ["Critical issues", critical, "text-red-700"],
              ["High priority", high, "text-amber-700"],
              ["Other opportunities", other, "text-indigo-700"],
            ].map(([label, value, tone]) => (
              <Link
                key={label}
                href="/issues"
                className="card card-hover p-3 sm:p-5"
              >
                <span className="flex items-center justify-between text-xs text-slate-500">
                  {label}
                  <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                </span>
                <span
                  className={`mt-3 block text-4xl font-medium tracking-tight ${tone}`}
                >
                  {value}
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  issue groups
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {coverage
              ? `${coverage.audited} of ${coverage.attempted} attempted URLs audited${coverage.partial ? " · Incomplete coverage. Score reflects the audited sample." : " · Within the configured audit limits."}`
              : "Results describe the pages checked in your latest audit."}
          </p>
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
            <section className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title">Start here</h2>
                <Link
                  href="/issues"
                  className="text-xs font-medium text-indigo-700 hover:underline"
                >
                  All issues <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
              {recommendations.length ? (
                <ol className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {recommendations.slice(0, 4).map((r, i) => (
                    <li
                      key={r.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        className="group flex items-start gap-4 p-5 transition-colors hover:bg-slate-50"
                      >
                        <span className="mt-1 font-mono text-xs text-slate-400">
                          0{i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{r.whatWrong}</p>
                          <p className="body mt-1 text-[13px]">
                            {r.whatToChange}
                          </p>
                        </div>
                        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-700" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title={
                    detail.legacyAudit
                      ? "Refresh your audit"
                      : issues.length
                        ? "Review your audit findings"
                        : "No issues found in this sample"
                  }
                  body={
                    detail.legacyAudit
                      ? "Run a fresh audit to use the current checks and scoring."
                      : issues.length
                        ? "Open your audit to see the evidence behind each issue."
                        : "Keep an eye on your website with a fresh audit after your next change."
                  }
                  action={
                    <Link
                      href={`/projects/${project.id}`}
                      className="btn btn-secondary btn-md"
                    >
                      Open audit
                    </Link>
                  }
                />
              )}
            </section>
            <Guide />
          </div>
        </>
      )}
      <div className="mt-8 flex items-center gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 shrink-0" /> You review every draft.
        Changes are applied through your own website editor.
      </div>
    </Shell>
  );
}
function Guide() {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-[#eeeee5]/60 p-6">
      <FileCheck2 className="h-6 w-6 text-indigo-700" strokeWidth={1.5} />
      <h2 className="mt-5 text-lg font-medium tracking-tight">
        A good rhythm for growth.
      </h2>
      <p className="body mt-2 text-[13px]">
        Take one improvement through the whole process before moving to the
        next.
      </p>
      <ol className="mt-6 space-y-4">
        {[
          "Review the issue and its page evidence",
          "Approve a draft you’re happy with",
          "Apply it in your website editor",
          "Run a fresh audit to check the change",
        ].map((t, i) => (
          <li
            key={t}
            className="flex items-start gap-3 text-xs leading-5 text-slate-600"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px]">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>
      <Link
        href="/help"
        className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-indigo-700"
      >
        A little help along the way <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}
