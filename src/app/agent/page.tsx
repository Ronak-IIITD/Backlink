"use client";
import { Shell } from "@/components/shell";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Badge, Button, EmptyState, LoadingState, toast } from "@/components/ui";
import { AnimatedProgress, AnimatedNumber, useReducedMotionFlag } from "@/components/motion";
import { clsx } from "clsx";
import { easeOutExpo, duration, staggerItem } from "@/lib/motion";

type Rec = { id: string; category: string; bucket: string; priority: number; whatWrong: string; whyMatters: string; whatToChange: string; canAutomate: boolean; needsApproval: string | null };

export default function AgentPage() {
  const [pid, setPid] = useState<string | null>(null);
  const [pname, setPname] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ costUsd: number; tokens: number } | null>(null);
  const [budget, setBudget] = useState<any>(null);
  const [cms, setCms] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reduce = useReducedMotionFlag();

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(async (j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      if (!j.data[0]) { setLoading(false); return; }
      setPid(j.data[0].id); setPname(j.data[0].name);
      const [r2, a, rn] = await Promise.all([
        fetch(`/api/projects/${j.data[0].id}/recommendations`).then((x) => x.json()),
        fetch(`/api/projects/${j.data[0].id}/actions`).then((x) => x.json()),
        fetch(`/api/projects/${j.data[0].id}/runs`).then((x) => x.json()).catch(() => null),
      ]);
      if (r2.ok) { setRecs(r2.data.recommendations); setSel(r2.data.recommendations[0]?.id || null); }
      if (a.ok) setActions(a.data);
      if (rn?.ok) { setRuns(rn.data.runs || []); setTotals(rn.data.totals || null); setBudget(rn.data.budget || null); setCms(rn.data.cms || null); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selected = recs.find((r) => r.id === sel) || null;
  const relatedActions = useMemo(() => actions.filter((a) => selected && (a.recommendationId === selected.id || (a.payload || "").includes(selected.whatWrong.slice(0, 24)))), [actions, selected]);
  const now = recs.filter((r) => r.bucket === "DO_THIS_NOW");
  const next = recs.filter((r) => r.bucket === "DO_THIS_NEXT");
  const watch = recs.filter((r) => r.bucket === "WATCH");
  const awaiting = actions.filter((a) => a.status === "awaiting_approval");
  const done = Math.max(0, recs.length - awaiting.length - next.length);

  async function decide(id: string, path: "approve" | "reject") {
    setBusy(id);
    try {
      const j = await fetch(`/api/actions/${id}/${path}`, { method: "POST" }).then((r) => r.json());
      if (j.ok && pid) {
        toast(path === "approve" ? "Fix approved" : "Fix rejected");
        const a = await fetch(`/api/projects/${pid}/actions`).then((x) => x.json());
        if (a.ok) setActions(a.data);
      }
    } finally { setBusy(null); }
  }

  if (loading) return <Shell><h1 className="page-title">Agent workspace</h1><p className="body mt-1">Loading agent workspace…</p><div className="mt-5"><LoadingState lines={5} /></div></Shell>;
  if (!pid) return <Shell><EmptyState title="No sites yet" body="Create a project and run an audit — the agent workspace fills with ranked tasks." action={<Link href="/projects" className="btn btn-primary btn-md">Analyze my website</Link>} /></Shell>;

  return (
    <Shell>
      <div className="mb-4">
        <div className="ai-chip w-fit"><Bot className="h-3.5 w-3.5" aria-hidden /> SEO agent — {pname}</div>
        <h1 className="page-title mt-2">Agent workspace</h1>
        <p className="body mt-1">Actions, not chat. The agent shows evidence, drafts, and what needs your decision.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_320px]">
        {/* Left: tasks — arrive with a quiet stagger */}
        <motion.aside
          className="card h-fit p-3"
          aria-label="Agent tasks"
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        >
          <TaskGroup title="Do this now" items={now} sel={sel} onSel={setSel} tone="now" />
          <TaskGroup title="Do this next" items={next} sel={sel} onSel={setSel} tone="next" />
          <TaskGroup title="Watch" items={watch} sel={sel} onSel={setSel} tone="watch" />
        </motion.aside>

        {/* Center: reasoning + activity — steps reveal in sequence */}
        <motion.section
          key={selected?.id || "none"}
          className="card p-5"
          aria-label="Agent activity"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.base, ease: easeOutExpo }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title text-[15px]">Task — {selected ? bucketLabel(selected.bucket) : "…"}</h2>
            {selected && <Badge tone={selected.bucket === "DO_THIS_NOW" ? "now" : selected.bucket === "WATCH" ? "watch" : "next"}>{bucketLabel(selected.bucket)}</Badge>}
          </div>
          {selected ? (
            <>
              <div className="mt-2"><AnimatedProgress value={recs.length ? Math.min(96, 20 + (done / Math.max(1, recs.length)) * 76) : 8} tone="accent" /></div>
              <ol className="mt-4 space-y-0">
                <Step done title="Analyzed crawled pages" sub={`${recs.length} recommendations ranked by impact`} delay={0.05} />
                <Step done title="Identified what matters" sub={selected.whatWrong} delay={0.18} />
                <Step done={!!relatedActions.length || selected.canAutomate} title={selected.canAutomate ? "Generated replacement" : "Documented manual fix"} sub={selected.whatToChange} delay={0.31} />
                <Step now title={awaiting.length ? `${awaiting.length} change${awaiting.length > 1 ? "s" : ""} waiting for approval` : "Nothing waiting — queue is clear"} sub={selected.needsApproval || "Approvals are recorded with reviewer and timestamp."} delay={0.44} />
              </ol>
              <motion.div
                className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: duration.base }}
              >
                <div className="eyebrow">Why this matters</div>
                <p className="body mt-1 text-slate-700">{selected.whyMatters}</p>
              </motion.div>
            </>
          ) : (
            <p className="body mt-3">Select a task on the left to see reasoning, evidence, and drafts.</p>
          )}
        </motion.section>

        {/* Right: context + approvals — queue enters/exits smoothly */}
        <aside className="space-y-4" aria-label="Context and approvals">
          <div className="card p-4">
            <h3 className="section-title text-[15px]">Needs approval (<AnimatedNumber value={awaiting.length} />)</h3>
            <div className="mt-3 space-y-2.5">
              <AnimatePresence initial={false}>
                {awaiting.slice(0, 4).map((a: any) => (
                  <motion.div
                    key={a.id}
                    layout
                    className="rounded-[10px] border border-amber-200 bg-amber-50/50 p-3"
                    initial={reduce ? false : { opacity: 0, y: 8, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
                    transition={{ duration: duration.base, ease: easeOutExpo }}
                  >
                    <div className="text-sm font-semibold">{prettyKind(a.kind)}</div>
                    <div className="mt-1 line-clamp-3 text-[13px] text-slate-600">{a.proposedValue}</div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => decide(a.id, "reject")}>Reject</Button>
                      <Button size="sm" disabled={busy === a.id} onClick={() => decide(a.id, "approve")}>
                        {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!awaiting.length && <p className="body">Queue clear. New drafts appear here after you select Review AI fix on an issue.</p>}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="section-title text-[15px]">Context</h3>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Site</dt><dd className="font-medium">{pname}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Recommendations</dt><dd className="font-semibold tabular-nums"><AnimatedNumber value={recs.length} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Drafted fixes</dt><dd className="font-semibold tabular-nums"><AnimatedNumber value={actions.length} /></dd></div>
              {totals && (
                <>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Agent runs</dt><dd className="font-semibold tabular-nums">{runs.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">AI cost</dt><dd className="font-semibold tabular-nums">${totals.costUsd.toFixed(4)} · {totals.tokens} tok</dd></div>
                  {budget && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Budget</dt>
                      <dd className={`font-semibold tabular-nums ${budget.allowed ? "text-emerald-700" : "text-amber-700"}`}>
                        {budget.allowed ? `$${(budget.caps.monthlyCostUsd - budget.monthCost).toFixed(2)} left` : "capped · $0 mode"}
                      </dd>
                    </div>
                  )}
                  {cms && (
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">CMS apply</dt><dd className="font-semibold">{cms.active}</dd></div>
                  )}
                </>
              )}
            </dl>
            <Link href={pid ? `/projects/${pid}` : "/projects"} className="btn btn-secondary btn-sm mt-3 w-full">Open full audit</Link>
          </div>
          {runs.length > 0 && (
            <div className="card p-4">
              <h3 className="section-title text-[15px]">Run history</h3>
              <ol className="mt-2 space-y-2">
                {runs.slice(0, 5).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.agent}</span>
                    <span className="shrink-0 text-slate-500">{r.status} · {r.tokensUsed} tok{r.durationMs ? ` · ${r.durationMs}ms` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function TaskGroup({ title, items, sel, onSel, tone }: { title: string; items: Rec[]; sel: string | null; onSel: (id: string) => void; tone: string }) {
  const reduce = useReducedMotionFlag();
  if (!items.length) return null;
  return (
    <div className="mb-3 last:mb-0">
      <div className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title} · {items.length}</div>
      <div className="space-y-1">
        {items.slice(0, 6).map((r) => (
          <motion.button
            key={r.id} onClick={() => onSel(r.id)} aria-pressed={sel === r.id}
            variants={staggerItem}
            whileTap={reduce ? undefined : { scale: 0.985 }}
            className={clsx(
              "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150",
              sel === r.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"
            )}
          >
            <span className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", sel === r.id ? "bg-white" : tone === "now" ? "bg-red-500" : tone === "next" ? "bg-indigo-500" : "bg-slate-300")} aria-hidden />
            <span className="min-w-0"><span className="block truncate font-medium">{r.whatWrong}</span><span className={clsx("block truncate text-xs", sel === r.id ? "text-slate-300" : "text-slate-500")}>{r.category} · #{r.priority}</span></span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function Step({ done, now, title, sub, delay }: { done?: boolean; now?: boolean; title: string; sub: string; delay?: number }) {
  const reduce = useReducedMotionFlag();
  return (
    <motion.li
      className="flex gap-3 border-b border-slate-100 py-3 last:border-0"
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: duration.base, ease: easeOutExpo }}
    >
      <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-100 text-emerald-700" : now ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`} aria-hidden>
        {done ? <Check className="h-3 w-3" /> : now ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden /> : "·"}
      </span>
      <div className="min-w-0"><div className="text-sm font-medium">{title}</div><div className="text-[13px] text-slate-500">{sub}</div></div>
    </motion.li>
  );
}

function bucketLabel(b: string) {
  return b.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
function prettyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
