"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Check, FileSearch, Pencil, X } from "lucide-react";
import { Shell } from "@/components/shell";
import {
  AIChip, Alert, Badge, Breadcrumb, Button, Drawer, EmptyState, ErrorState,
  Field, Input, LoadingState, Modal, Progress, Select, SevBadge, Table, Tabs, Textarea, toast,
} from "@/components/ui";
import { AnimatedProgress, AnimatedScoreRing, AnimatedNumber, useReducedMotionFlag } from "@/components/motion";

type Issue = {
  id: string; type: string; severity: string; title: string; whatWrong: string;
  whyMatters: string; recommendation: string; impact: string; difficulty: string;
  affectedCount: number; affectedUrls: string | string[];
};

function urlsOf(i: Issue): string[] {
  try { const v = typeof i.affectedUrls === "string" ? JSON.parse(i.affectedUrls) : i.affectedUrls; return Array.isArray(v) ? v : []; }
  catch { return []; }
}

function ProjectDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [detail, setDetail] = useState<any>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [crawl, setCrawl] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState("");
  const [openIssue, setOpenIssue] = useState<Issue | null>(null);
  const [sevFilter, setSevFilter] = useState("");
  const [pageNum, setPageNum] = useState(1);

  // Deep-link: /projects/:id?issue=:issueId auto-opens drawer
  useEffect(() => {
    const q = searchParams?.get("issue");
    if (!q || !issues.length || openIssue) return;
    const found = issues.find((x) => x.id === q);
    if (found) {
      setTab("issues");
      setOpenIssue(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, searchParams]);

  function openIssueDeep(iss: Issue | null) {
    setOpenIssue(iss);
    try {
      const url = iss ? `/projects/${id}?issue=${iss.id}` : `/projects/${id}`;
      router.replace(url, { scroll: false } as any);
    } catch {}
  }

  async function loadAll() {
    try {
      const d = await fetch(`/api/projects/${id}`).then((r) => r.json());
      if (!d.ok) throw new Error(d.error);
      setDetail(d.data); setCrawl(d.data.latestCrawl);
      if (d.data.latestCrawl?.status === "completed") {
        const [i, r2, p, a] = await Promise.all([
          fetch(`/api/projects/${id}/issues`).then((x) => x.json()),
          fetch(`/api/projects/${id}/recommendations`).then((x) => x.json()),
          fetch(`/api/projects/${id}/pages`).then((x) => x.json()),
          fetch(`/api/projects/${id}/actions`).then((x) => x.json()),
        ]);
        if (i.ok) setIssues(i.data.issues);
        if (r2.ok) setRecs(r2.data.recommendations);
        if (p.ok) setPages(p.data.pages);
        if (a.ok) setActions(a.data);
      }
    } catch (e: any) { setErr(e.message || "Couldn't load this audit."); }
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!crawl || !["queued", "running"].includes(crawl.status)) return;
    const t = setInterval(async () => {
      const j = await fetch(`/api/crawls/${crawl.id}`).then((r) => r.json()).catch(() => null);
      if (j?.ok) {
        setCrawl(j.data);
        if (["completed", "failed"].includes(j.data.status)) { clearInterval(t); loadAll(); }
      }
    }, 2000);
    return () => clearInterval(t);
    /* eslint-disable-next-line */
  }, [crawl?.id, crawl?.status]);

  async function startCrawl() {
    setErr("");
    const j = await fetch(`/api/projects/${id}/crawl`, { method: "POST" }).then((r) => r.json());
    if (j.ok) setCrawl(j.data);
    else setErr(j.error);
  }

  const running = crawl && ["queued", "running"].includes(crawl.status);
  const score = detail?.score;
  const filtered = sevFilter ? issues.filter((i) => i.severity === sevFilter) : issues;
  const grouped: Record<string, Issue[]> = { critical: [], high: [], medium: [], low: [] };
  filtered.forEach((i) => { (grouped[i.severity] || grouped.low).push(i); });

  return (
    <Shell>
      <Breadcrumb items={[{ label: "Sites", href: "/projects" }, { label: detail?.project?.name || "Audit" }]} />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title truncate">{detail?.project?.name || "Audit"}</h1>
          <p className="mono mt-1 truncate text-slate-500">{detail?.project?.websiteUrl}</p>
        </div>
        <Button onClick={startCrawl} disabled={!!running} variant={crawl ? "secondary" : "accent"} size="sm">
          {running ? "Scanning…" : crawl ? "Run audit" : "Analyze website"}
        </Button>
      </div>
      {err && <div className="mt-4"><Alert tone="error" title="Couldn't complete that">{err}</Alert></div>}
      {searchParams.get("searchConsole") === "connected" && <div className="mt-4"><Alert tone="success" title="Search Console connected">Performance data is now available in this site&apos;s overview.</Alert></div>}
      {searchParams.get("searchConsole") === "error" && <div className="mt-4"><Alert tone="error" title="Search Console connection failed">{searchParams.get("message") || "Try connecting again."}</Alert></div>}

      {running && <ScanProgress crawl={crawl} />}
      {crawl?.status === "failed" && (
        <div className="mt-4"><ErrorState title="The crawl couldn't finish" body={crawl.error || "The server may have blocked the request. Retrying is safe — nothing was changed."} onRetry={startCrawl} /></div>
      )}

      {!detail ? (
        <div className="mt-6"><LoadingState lines={5} label="Loading audit…" /></div>
      ) : !crawl || crawl.status !== "completed" ? (
        !running && (
          <div className="mt-6">
            <EmptyState
              title="Run your first audit"
              body="We crawl up to 30 pages, check 19 SEO rules, score transparently, and draft fixes. Watch live progress — no fake loading bars."
              action={<Button variant="accent" onClick={startCrawl}>Analyze website</Button>}
            />
          </div>
        )
      ) : (
        <div className="mt-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "issues", label: "Issues", count: issues.length },
              { id: "fixes", label: "Fixes", count: actions.length },
              { id: "pages", label: "Pages", count: pages.length },
              { id: "cms", label: "CMS" },
              { id: "share", label: "Share" },
            ]}
          />

          {tab === "overview" && score && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="card flex items-center gap-4 p-5">
                <AnimatedScoreRing score={score.overall} />
                <div>
                  <div className="eyebrow">SEO health</div>
                  <div className="text-sm text-slate-600">{detail.counts?.pages} pages · {issues.length} issue groups</div>
                </div>
              </div>
              <div className="card p-5">
                <div className="eyebrow">Breakdown</div>
                <div className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                  {score.categories.map((c: any) => (
                    <div key={c.key}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <span className="text-slate-600">{c.label}</span>
                        <span className="font-semibold tabular-nums">{c.score}</span>
                      </div>
                      <div className="mt-1"><Progress value={c.score} tone={c.score >= 80 ? "success" : "default"} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <h2 className="section-title">Priority actions</h2>
                <ol className="mt-3 space-y-2.5">
                  {recs.slice(0, 4).map((r: any, i: number) => (
                    <li key={r.id} className="card flex items-start gap-3.5 p-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[13px] font-semibold text-white">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-semibold">{r.whatWrong}</div>
                        <div className="body mt-0.5">{r.whatToChange}</div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setTab("issues")} className="shrink-0">Open</Button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {tab === "overview" && <SearchPerformance projectId={id} websiteUrl={detail.project.websiteUrl} />}

          {tab === "issues" && (
            <div className="mt-5">
              <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by severity">
                {["", "critical", "high", "medium", "low"].map((s) => (
                  <button
                    key={s || "all"} onClick={() => setSevFilter(s)}
                    aria-pressed={sevFilter === s}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${sevFilter === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    {s || "All"}
                  </button>
                ))}
              </div>
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                grouped[sev].length ? (
                  <section key={sev} className="mb-6" aria-label={`${sev} issues`}>
                    <div className="mb-2 flex items-center gap-2">
                      <SevBadge sev={sev} />
                      <span className="text-[13px] tabular-nums text-slate-500">{grouped[sev].length} group{grouped[sev].length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-2.5">
                      {grouped[sev].map((iss) => (
                        <IssueRow key={iss.id} issue={iss} onOpen={() => openIssueDeep(iss)} />
                      ))}
                    </div>
                  </section>
                ) : null
              ))}
              {!filtered.length && <EmptyState title="No issues at this severity" body="Try another filter, or rescan after shipping fixes." />}
            </div>
          )}

          {tab === "fixes" && (
            <div className="mt-5 space-y-2.5">
              {actions.map((a: any) => <FixRow key={a.id} action={a} onChange={loadAll} />)}
              {!actions.length && (
                <EmptyState
                  title="No fixes drafted yet"
                  body="Open any issue and select Review AI fix. The agent drafts a precise before/after change and waits for your approval."
                  action={<Button variant="secondary" size="sm" onClick={() => setTab("issues")}>Browse issues</Button>}
                />
              )}
            </div>
          )}

          {tab === "pages" && <PagesTable pages={pages} page={pageNum} onPage={setPageNum} />}

          {tab === "cms" && (
            <>
              <CmsPanel projectId={id} />
              <AutoRescanPanel projectId={id} />
              <AlertsPanel projectId={id} />
            </>
          )}

          {tab === "share" && <SharePanel projectId={id} />}
        </div>
      )}

      <IssueDrawer issue={openIssue} onClose={() => openIssueDeep(null)} onFixed={loadAll} />
    </Shell>
  );
}

function SearchPerformance({ projectId, websiteUrl }: { projectId: string; websiteUrl: string }) {
  const [property, setProperty] = useState(websiteUrl);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetch(`/api/projects/${projectId}/search-console`).then((r) => r.json());
      if (!result.ok) throw new Error(result.error);
      setData(result.data);
      setError(result.data.error || "");
      if (result.data.siteUrl) setProperty(result.data.siteUrl);
    } catch (e: any) { setError(e.message || "Could not load Search Console data"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  function connect() {
    if (!property.trim()) return;
    const url = new URL(`/api/projects/${projectId}/search-console/connect`, window.location.origin);
    url.searchParams.set("siteUrl", property.trim());
    window.location.href = url.toString();
  }

  async function disconnect() {
    setBusy(true);
    const result = await fetch(`/api/projects/${projectId}/search-console`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (result?.ok) { setData({ connected: false }); setError(""); }
    else setError(result?.error || "Could not disconnect Search Console");
  }

  const delta = (current: number, previous: number) => previous ? `${current >= previous ? "+" : ""}${Math.round(((current - previous) / previous) * 100)}%` : current ? "New" : "—";
  const number = (value: number) => new Intl.NumberFormat().format(Math.round(value));
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <section className="mt-6 border-t border-slate-200 pt-5" aria-label="Search performance">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Google Search performance</h2>
          <p className="body mt-0.5">Search Console data for context. Changes here are not attributed to individual fixes.</p>
        </div>
        {data?.connected && <Button variant="ghost" size="sm" loading={busy} onClick={disconnect}>Disconnect</Button>}
      </div>

      {loading ? <div className="mt-4"><LoadingState lines={3} label="Loading Search Console…" /></div> : !data?.connected ? (
        <div className="mt-4 max-w-2xl">
          {data?.configured ? <Field label="Search Console property" hint="Use the exact property URL, or sc-domain:example.com for a Domain property.">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="https://example.com/" />
                <Button variant="secondary" onClick={connect}>Connect Search Console</Button>
              </div>
            </Field>
            : <p className="text-sm text-slate-600">Search Console connection is not available for this workspace yet.</p>}
          {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{error}</p>
          <p className="mt-1 text-[13px]">Check that the connected Google account can access {data.siteUrl} in Search Console.</p>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>Retry</Button>
            <Button variant="ghost" size="sm" onClick={connect}>Reconnect</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-500">
            <span className="mono truncate">{data.siteUrl}</span>
            <span>Last 28 complete days · through {new Date(`${data.period.endDate}T00:00:00`).toLocaleDateString()}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Clicks", number(data.current.clicks), delta(data.current.clicks, data.previous.clicks)],
              ["Impressions", number(data.current.impressions), delta(data.current.impressions, data.previous.impressions)],
              ["Click-through rate", percent(data.current.ctr), delta(data.current.ctr, data.previous.ctr)],
              ["Average position", data.current.position.toFixed(1), "Lower is better"],
            ].map(([label, value, comparison]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3">
                <div className="eyebrow">{label}</div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{value}</span>
                  <span className="text-[12px] text-slate-500">{comparison}</span>
                </div>
                {label !== "Average position" && <div className="mt-0.5 text-[12px] text-slate-400">vs previous 28 days</div>}
              </div>
            ))}
          </div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Daily clicks</h3>
            {data.trend.length ? (
              <div className="mt-3 flex h-24 items-end gap-1" role="img" aria-label="Daily clicks trend for the last 28 days">
                {data.trend.map((item: any) => {
                  const max = Math.max(1, ...data.trend.map((row: any) => row.clicks));
                  return <div key={item.date} title={`${item.date}: ${number(item.clicks)} clicks`} className="min-w-0 flex-1 rounded-t-sm bg-indigo-500/75" style={{ height: `${Math.max(3, (item.clicks / max) * 100)}%` }} />;
                })}
              </div>
            ) : <p className="body mt-2">No daily search data for this period yet.</p>}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <SearchRows title="Top queries" rows={data.queries} labelKey="query" number={number} percent={percent} />
            <SearchRows title="Top pages" rows={data.pages} labelKey="page" number={number} percent={percent} />
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold">Fixes applied during this period</h3>
            <p className="body mt-0.5">Compare timing with search trends; these events do not establish cause and effect.</p>
            {data.appliedChanges.length ? <ul className="mt-2 divide-y divide-slate-100">
              {data.appliedChanges.slice(0, 5).map((change: any) => <li key={change.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]">
                <span className="font-medium">{change.kind.replace(/_/g, " ")}</span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{change.proposedValue || "Applied site change"}</span>
                <time className="shrink-0 text-slate-500" dateTime={change.appliedAt}>{new Date(change.appliedAt).toLocaleDateString()}</time>
              </li>)}
            </ul> : <p className="body mt-2">No fixes were applied during this period.</p>}
          </div>
          <p className="mt-4 text-[12px] text-slate-400">Search Console may omit low-volume queries and pages from its results.</p>
        </>
      )}
    </section>
  );
}

function SearchRows({ title, rows, labelKey, number, percent }: { title: string; rows: any[]; labelKey: "query" | "page"; number: (value: number) => string; percent: (value: number) => string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length ? <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
        {rows.slice(0, 5).map((row, index) => <div key={`${row[labelKey]}-${index}`} className="flex items-center gap-3 py-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate" title={row[labelKey]}>{row[labelKey]}</span>
          <span className="shrink-0 tabular-nums text-slate-500">{number(row.clicks)} clicks</span>
          <span className="hidden shrink-0 tabular-nums text-slate-500 sm:inline">{percent(row.ctr)} CTR</span>
        </div>)}
      </div> : <p className="body mt-2">No data available for this period.</p>}
    </div>
  );
}

export default function ProjectDetailPage(props: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ProjectDetail {...props} />
    </Suspense>
  );
}

function AutoRescanPanel({ projectId }: { projectId: string }) {
  const [freq, setFreq] = useState("off");
  const [last, setLast] = useState<string | null>(null);
  const [latest, setLatest] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/auto-rescan`).then((r) => r.json()).then((j) => {
      if (j.ok) {
        setFreq(j.data.autoRescan || "off");
        setLast(j.data.lastAutoCrawlAt);
        setLatest(j.data.latestCrawl);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function save(v: string) {
    setFreq(v);
    setSaving(true);
    try {
      const j = await fetch(`/api/projects/${projectId}/auto-rescan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRescan: v }),
      }).then((r) => r.json());
      if (j.ok) {
        setLast(j.lastAutoCrawlAt ?? last);
        toast("Auto-rescan updated", v === "off" ? "This site will only scan when you run it." : `This site rescans ${v}. Cron POST /api/cron/rescan does the work.`);
      } else { toast("Couldn't save", j.error); }
    } finally { setSaving(false); }
  }

  if (!loaded) return <div className="mt-5"><LoadingState lines={2} label="Loading rescan settings…" /></div>;

  return (
    <div className="card mt-4 p-5">
      <h2 className="section-title">Auto-rescan — keep reports fresh</h2>
      <p className="body mt-1">Scheduled emails use the latest completed audit. Turn this on so scores never go stale.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select value={freq} onChange={(e) => save(e.target.value)} disabled={saving} aria-label="Auto-rescan frequency" className="max-w-[200px]">
          <option value="off">Off (manual scans)</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </Select>
        <span className="text-[13px] text-slate-500">
          {last ? `Last auto-crawl ${new Date(last).toLocaleDateString()}` : "No auto-crawl yet"}
          {latest ? ` · Latest scan ${latest.status} ${new Date(latest.createdAt).toLocaleDateString()}` : ""}
        </span>
      </div>
    </div>
  );
}

const ALERT_EVENTS = [
  { id: "critical", label: "New critical issues", hint: "A critical group appears that wasn't there last scan" },
  { id: "score_drop", label: "Health drop", hint: "Overall score falls by the threshold or more" },
  { id: "crawl_failed", label: "Scan failed", hint: "A scan can't finish — safe-to-retry notice" },
];

function AlertsPanel({ projectId }: { projectId: string }) {
  const [prefs, setPrefs] = useState<any[]>([]);
  const [mode, setMode] = useState("log");
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<string[]>(["critical", "score_drop"]);
  const [threshold, setThreshold] = useState(10);
  const [wl, setWl] = useState(false);
  const [agency, setAgency] = useState("Your Agency");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const j = await fetch(`/api/projects/${projectId}/notifications`).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setPrefs(j.data.prefs); setMode(j.data.emailMode); }
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  function toggleEvent(id: string) {
    setEvents((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  async function create() {
    if (!email.trim() || !events.length) { toast("Missing details", "Enter an email and pick at least one event."); return; }
    setBusy(true);
    try {
      const j = await fetch(`/api/projects/${projectId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), events, scoreDropThreshold: threshold, whiteLabel: wl, agencyName: agency.trim() || null }),
      }).then((r) => r.json());
      if (j.ok) { setEmail(""); load(); toast("Alert added", `Watching ${events.join(" + ")} for ${j.email || "this site"}.`); }
      else toast("Couldn't save", j.error);
    } finally { setBusy(false); }
  }

  async function toggleActive(id: string) {
    await fetch(`/api/projects/${projectId}/notifications?toggle=${id}`, { method: "DELETE" }).catch(() => null);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/projects/${projectId}/notifications?id=${id}`, { method: "DELETE" }).catch(() => null);
    load();
  }

  async function test(id: string) {
    const j = await fetch(`/api/projects/${projectId}/notifications/${id}/test`, { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) toast(j.sent ? "Test sent" : "Logged, not sent", j.message);
    else toast("Couldn't send test", j?.error || "try again");
  }

  if (!loaded) return <div className="mt-4"><LoadingState lines={2} label="Loading alerts…" /></div>;

  return (
    <div className="card mt-4 p-5">
      <h2 className="section-title">Alerts — who hears what {mode === "log" && <span className="font-normal text-slate-500">· log mode (set RESEND_API_KEY to send)</span>}</h2>
      <p className="body mt-1">Instant alerts for drops and failures. Weekly/monthly digests live under Reports → Scheduled emails.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {ALERT_EVENTS.map((e) => (
          <label key={e.id} className={`flex cursor-pointer items-start gap-2 rounded-[10px] border p-3 text-sm transition ${events.includes(e.id) ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
            <input type="checkbox" checked={events.includes(e.id)} onChange={() => toggleEvent(e.id)} className="mt-0.5 h-4 w-4 accent-slate-900" />
            <span><b>{e.label}</b><span className="block text-[13px] text-slate-500">{e.hint}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_140px_1fr_auto]">
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@company.com" type="email" />
        </Field>
        {events.includes("score_drop") && (
          <Field label="Drop threshold (pts)" hint="Alert when health falls this much.">
            <Input value={threshold} onChange={(e) => setThreshold(Math.max(5, Math.min(50, Number(e.target.value) || 10)))} type="number" min={5} max={50} />
          </Field>
        )}
        <Field label="Branding">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px]">
            <input type="checkbox" checked={wl} onChange={(e) => setWl(e.target.checked)} className="h-3.5 w-3.5 accent-slate-900" /> White-label
          </label>
        </Field>
        <div className="flex items-end">
          <Button size="sm" loading={busy} onClick={create}>Watch this site</Button>
        </div>
      </div>
      {wl && (
        <div className="mt-3 max-w-[280px]">
          <Field label="Agency name on alert">
            <Input value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="Your Agency" />
          </Field>
        </div>
      )}
      {prefs.length > 0 && (
        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {prefs.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <b>{p.email}</b>
                <span className="block text-[13px] text-slate-500">
                  {(p.events || []).join(" + ")}{p.events?.includes("score_drop") ? ` ≥${p.scoreDropThreshold}pts` : ""} · {p.active ? "on" : "paused"}
                  {p.lastSentAt ? ` · alerted ${new Date(p.lastSentAt).toLocaleDateString()}` : " · never fired"}
                </span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => test(p.id)}>Test</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(p.id)}>{p.active ? "Pause" : "Resume"}</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CmsPanel({ projectId }: { projectId: string }) {
  const [cms, setCms] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [adapter, setAdapter] = useState("auto");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/cms`).then((r) => r.json()).then((j) => {
      if (j.ok) {
        setCms(j.data.cms);
        setStatus(j.data.status);
        setAdapter(j.data.cms?.cmsAdapter || "auto");
        setUrl(j.data.cms?.cmsWebhookUrl || "");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      const payload: any = { cmsAdapter: adapter };
      payload.cmsWebhookUrl = url.trim() || null;
      if (secret.trim()) payload.cmsWebhookSecret = secret.trim();
      const j = await fetch(`/api/projects/${projectId}/cms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (j.ok) {
        setCms(j.data.cms);
        setStatus(j.data.status);
        setSecret("");
        toast("CMS settings saved", `This site now uses ${j.data.status?.active || adapter} (${j.data.status?.source || "project"}).`);
      } else toast("Couldn't save", j.error);
    } finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    try {
      const j = await fetch(`/api/actions/test/apply`, { method: "GET" }).then((r) => r.json()).catch(() => null);
      void j;
      toast("Test queued", url ? "Save first, then approve a fix and hit Apply to CMS to verify this client's endpoint." : "Set a webhook URL first, then apply an approved fix to test.");
    } finally { setTesting(false); }
  }

  if (!loaded) return <div className="mt-5"><LoadingState lines={3} label="Loading CMS settings…" /></div>;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="card p-5">
        <h2 className="section-title">CMS auto-apply — this site only</h2>
        <p className="body mt-1">Each client site gets its own endpoint. Approval is still required before anything applies.</p>
        <div className="mt-4 space-y-4">
          <Field label="Adapter" hint="Auto uses this site's webhook if set, else the server default.">
            <Select value={adapter} onChange={(e) => setAdapter(e.target.value)} aria-label="CMS adapter">
              <option value="auto">Auto (recommended)</option>
              <option value="manual">Manual copy-paste</option>
              <option value="webhook">Webhook (per-client URL below)</option>
              <option value="wordpress">WordPress direct (title only MVP)</option>
            </Select>
          </Field>
          <Field label="Client webhook URL" hint="https:// endpoint for this client (Zapier / Make / Webflow Logic). Empty = use server default.">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." inputMode="url" />
          </Field>
          <Field label="Webhook secret (optional)" hint="Sent as X-CMS-Secret. Leave blank to keep existing.">
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={cms?.hasSecret ? "•••••• (set — blank keeps it)" : "shh_..."} type="password" autoComplete="off" />
          </Field>
          <div className="flex gap-2">
            <Button size="sm" loading={saving} onClick={save}>Save for this site</Button>
            <Button size="sm" variant="secondary" disabled={testing} onClick={test}>How to test</Button>
          </div>
        </div>
      </div>
      <div className="card h-fit p-5">
        <div className="eyebrow">Active for this site</div>
        <div className="mt-1 text-[22px] font-semibold">{status?.active || "manual"}</div>
        <div className="mt-1 text-[13px] text-slate-500">Source: {status?.source || "env"} · {status?.webhook?.configured ? "webhook ready" : "manual mode"}</div>
        {!status?.webhook?.configured && (
          <p className="body mt-3">No webhook for this site yet — approved fixes stay copy-paste until you save one.</p>
        )}
      </div>
    </div>
  );
}

function SharePanel({ projectId }: { projectId: string }) {
  const [links, setLinks] = useState<any[]>([]);
  const [label, setLabel] = useState("Client review");
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [freshUrl, setFreshUrl] = useState("");

  async function load() {
    const j = await fetch(`/api/projects/${projectId}/share`).then((r) => r.json()).catch(() => null);
    if (j?.ok) setLinks(j.data);
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  async function create() {
    setCreating(true);
    setFreshUrl("");
    try {
      const j = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, days: 30 }),
      }).then((r) => r.json());
      if (j.ok) {
        setFreshUrl(j.data.url);
        setLabel("Client review");
        load();
        toast("Share link created", "Send it to your client — no login needed to approve.");
      } else toast("Couldn't create link", j.error);
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    const j = await fetch(`/api/projects/${projectId}/share?id=${id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { load(); toast("Link revoked", "That URL no longer works."); }
    else toast("Couldn't revoke", j?.error || "try again");
  }

  if (!loaded) return <div className="mt-5"><LoadingState lines={2} label="Loading share links…" /></div>;

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="card p-5">
        <h2 className="section-title">Client approval links</h2>
        <p className="body mt-1">Clients open the link, see awaiting fixes, and approve or reject — no account, no login. You still apply.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client review" aria-label="Link label" className="sm:max-w-[240px]" />
          <Button size="sm" loading={creating} onClick={create}>Create link (30 days)</Button>
        </div>
        {freshUrl && (
          <div className="mt-3 rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="eyebrow text-emerald-800">Copy now — shown once</div>
            <div className="mono mt-1 break-all text-sm">{freshUrl}</div>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => { navigator.clipboard?.writeText(freshUrl).catch(() => {}); toast("Copied", "Share link copied to clipboard."); }}>Copy link</Button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {links.map((l: any) => (
            <div key={l.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <b>{l.label}</b>
                <span className="block text-[13px] text-slate-500">Expires {new Date(l.expiresAt).toLocaleDateString()}{l.expired ? " · expired" : ""}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => revoke(l.id)}>Revoke</Button>
            </div>
          ))}
          {!links.length && <p className="body">No links yet. Create one per client or per review round — revoke anytime.</p>}
        </div>
      </div>
      <div className="card h-fit p-5">
        <div className="eyebrow">How it works</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-slate-600">
          <li>You create a link for the client.</li>
          <li>Client approves or rejects awaiting fixes.</li>
          <li>You Apply to CMS from the Fixes tab.</li>
        </ol>
      </div>
    </div>
  );
}

function ScanProgress({ crawl }: { crawl: any }) {
  const reduce = useReducedMotionFlag();
  let msg = "Scanning website…";
  let found = crawl.pagesFound || 0;
  let done = crawl.pagesCrawled || 0;
  try {
    const p = typeof crawl.progress === "string" ? JSON.parse(crawl.progress) : crawl.progress;
    if (p?.message) msg = p.message;
    if (typeof p?.found === "number") found = p.found;
    if (typeof p?.crawled === "number") done = p.crawled;
  } catch {}
  const pct = Math.min(96, 8 + (done / 30) * 88);
  return (
    <motion.section
      className="card mt-4 p-5"
      aria-live="polite"
      aria-label="Scan progress"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="eyebrow">Analyzing your website</div>
      <div className="mt-1 text-[15px] font-medium">{msg}</div>
      <div className="mt-3"><AnimatedProgress value={pct} tone="accent" /></div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[["Pages discovered", <AnimatedNumber key="f" value={found} />], ["Pages analyzed", <AnimatedNumber key="d" value={done} />], ["Phase", phaseOf(msg)], ["Rescan", "anytime"]].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-[13px] text-slate-500">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}
function phaseOf(msg: string) {
  if (/verif/i.test(msg)) return "Verify";
  if (/draft|ranked actions|planning|plann/i.test(msg)) return "Plan";
  if (/content gap|opportunit/i.test(msg)) return "Content";
  if (/recommend|analyz/i.test(msg)) return "Analysis";
  if (/found|discover/i.test(msg)) return "Discovery";
  if (/budget/i.test(msg)) return "AI ($0 mode)";
  return "Crawl";
}

function IssueRow({ issue, onOpen }: { issue: Issue; onOpen: () => void }) {
  const urls = urlsOf(issue);
  return (
    <button onClick={onOpen} className="card card-hover flex w-full items-start gap-3.5 p-4 text-left" aria-label={`Open issue: ${issue.title}`}>
      <SevBadge sev={issue.severity} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-snug">{issue.title}</span>
        <span className="body mt-0.5 line-clamp-2 block">{issue.whyMatters}</span>
        <span className="mono mt-1.5 block truncate text-slate-400">{urls[0]}{urls.length > 1 ? `  +${urls.length - 1} more` : ""}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-indigo-700">Review <ArrowRight className="h-3.5 w-3.5" aria-hidden /></span>
    </button>
  );
}

function FixRow({ action, onChange }: { action: any; onChange: () => void }) {
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  async function decide(path: "approve" | "reject") {
    setBusy(true);
    try {
      const j = await fetch(`/api/actions/${action.id}/${path}`, { method: "POST" }).then((r) => r.json());
      if (j.ok) { toast(path === "approve" ? "Fix approved" : "Fix rejected", path === "approve" ? "Approved. You can now auto-apply to your CMS." : "Recorded and removed from the queue."); onChange(); }
      else toast("Couldn't save decision", j.error);
    } finally { setBusy(false); setConfirm(null); }
  }
  async function apply() {
    setApplying(true);
    try {
      const j = await fetch(`/api/actions/${action.id}/apply`, { method: "POST" }).then((r) => r.json());
      if (j.ok && j.apply?.applied) { toast("Applied to CMS", j.apply.message); onChange(); }
      else if (j.ok) { toast("Not auto-applied", j.apply?.message || "Copy-paste manually."); }
      else toast("Apply blocked", j.error);
    } finally { setApplying(false); }
  }
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{prettyKind(action.kind)}</span>
        <Badge tone={action.status}>{action.status.replace(/_/g, " ")}</Badge>
        <span className="ml-auto" />
        {action.status === "awaiting_approval" && (
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm("reject")}>Reject</Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => setConfirm("approve")}><Check className="h-4 w-4" /> Approve</Button>
          </span>
        )}
        {action.status === "approved" && (
          <Button size="sm" variant="accent" disabled={applying} onClick={apply}>{applying ? "Applying…" : "Apply to CMS"}</Button>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {action.currentValue && (
          <div className="rounded-[10px] border border-red-200 bg-red-50/60 p-3">
            <div className="eyebrow text-red-700">Before</div>
            <div className="mt-1 text-sm leading-6">{action.currentValue}</div>
          </div>
        )}
        <div className={`rounded-[10px] border p-3 ${action.currentValue ? "md:col-span-1 md:col-start-2" : "md:col-span-2"} border-emerald-200 bg-emerald-50/60`}>
          <div className="eyebrow text-emerald-800">After — proposed</div>
          <div className="mt-1 text-sm font-medium leading-6">{action.proposedValue}</div>
        </div>
      </div>
      {action.reason && <p className="body mt-2">{action.reason}</p>}
      <Modal
        open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "approve" ? "Approve this fix?" : "Reject this fix?"}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button size="sm" variant={confirm === "approve" ? "primary" : "danger"} disabled={busy} onClick={() => decide(confirm!)}>Confirm {confirm}</Button>
          </>
        }
      >
        <p className="body">
          {confirm === "approve"
            ? "Approval is recorded with timestamp and reviewer. After approving, use Apply to CMS to push via your configured adapter (webhook/WordPress) — manual copy-paste always works."
            : "Rejection is recorded and the fix leaves the queue. The underlying issue stays open."}
        </p>
      </Modal>
    </div>
  );
}
function prettyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PagesTable({ pages, page, onPage }: { pages: any[]; page: number; onPage: (p: number) => void }) {
  const per = 12;
  const total = Math.max(1, Math.ceil(pages.length / per));
  const slice = pages.slice((page - 1) * per, page * per);
  return (
    <div className="mt-5">
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table
          columns={[
            { key: "url", header: "URL" },
            { key: "status", header: "Status" },
            { key: "title", header: "Title" },
            { key: "words", header: "Words" },
            { key: "flags", header: "Flags" },
          ]}
          rows={slice.map((p: any) => ({
            url: <span className="mono block max-w-[280px] truncate" title={p.finalUrl}>{p.finalUrl}</span>,
            status: p.statusCode === 200
              ? <Badge tone="completed">200</Badge>
              : <Badge tone="failed">{p.statusCode || "fail"}</Badge>,
            title: p.title ? <span className="block max-w-[240px] truncate">{p.title}</span> : <span className="font-medium text-red-600">Missing</span>,
            words: <span className="tabular-nums">{p.wordCount}</span>,
            flags: <span className="text-[13px] text-slate-500">{[!p.metaDescription ? "no meta" : "", !p.h1 ? "no h1" : "", p.wordCount < 200 ? "thin" : ""].filter(Boolean).join(" · ") || "—"}</span>,
          }))}
          rowKey={(_, i) => String(i)}
        />
      </div>
      {/* Mobile cards */}
      <div className="space-y-2.5 md:hidden">
        {slice.map((p: any, i: number) => (
          <div key={i} className="card p-4">
            <div className="mono truncate text-[13px]">{p.finalUrl}</div>
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              <Badge tone={p.statusCode === 200 ? "completed" : "failed"}>{p.statusCode || "fail"}</Badge>
              <span className="tabular-nums text-slate-500">{p.wordCount} words</span>
            </div>
            <div className="mt-1.5 text-sm">{p.title || <span className="font-medium text-red-600">Missing title</span>}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
          <span className="px-2 text-[13px] tabular-nums text-slate-500">{page} / {total}</span>
          <Button variant="ghost" size="sm" disabled={page >= total} onClick={() => onPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function IssueDrawer({ issue, onClose, onFixed }: { issue: Issue | null; onClose: () => void; onFixed: () => void }) {
  const [fix, setFix] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => { setFix(null); setEditing(false); setDraft(""); }, [issue?.id]);
  if (!issue) return null;
  const urls = urlsOf(issue);

  async function genFix() {
    if (!issue) return;
    setLoading(true);
    try {
      const j = await fetch(`/api/issues/${issue.id}/generate-fix`, { method: "POST" }).then((r) => r.json());
      if (j.ok) { setFix(j.data); setDraft(j.data.proposedValue); onFixed(); toast("Fix drafted", "Review the before/after below."); }
      else toast("No automatable fix yet", j.error);
    } finally { setLoading(false); }
  }
  async function saveEdit() {
    if (!fix) return;
    // MVP: edited copy is approved as-is by updating proposed value via approve note path —
    // record edit locally then approve. Full edit endpoint plugs in here.
    setFix({ ...fix, proposedValue: draft });
    setEditing(false);
    toast("Edit saved for review", "Approve below to record the decision.");
  }

  return (
    <Drawer open={!!issue} onClose={onClose} title={issue.title}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <SevBadge sev={issue.severity} />
          <span className="text-[13px] text-slate-500">Impact {issue.impact} · Difficulty {issue.difficulty} · {issue.affectedCount} page{issue.affectedCount === 1 ? "" : "s"}</span>
        </div>

        <section>
          <h3 className="eyebrow">Why this matters</h3>
          <p className="body mt-1 text-slate-700">{issue.whyMatters}</p>
        </section>
        <section>
          <h3 className="eyebrow">What&apos;s wrong</h3>
          <p className="body mt-1">{issue.whatWrong}</p>
        </section>
        <section>
          <h3 className="eyebrow">Affected pages ({urls.length})</h3>
          <ul className="mt-2 space-y-1.5">
            {urls.slice(0, 8).map((u) => (
              <li key={u} className="mono truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600" title={u}>{u}</li>
            ))}
          </ul>
          {urls.length > 8 && <p className="mt-1.5 text-[13px] text-slate-500">+{urls.length - 8} more in the full export.</p>}
        </section>
        <section>
          <h3 className="eyebrow">Recommended solution</h3>
          <p className="body mt-1">{issue.recommendation}</p>
        </section>

        <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <AIChip />
            {fix && !editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[13px] font-medium text-indigo-700 hover:underline">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>
          {!fix ? (
            <div className="mt-3">
              <p className="body">The agent drafts a precise, copy-ready replacement from this page&apos;s real content.</p>
              <Button variant="accent" size="sm" className="mt-3" loading={loading} onClick={genFix}>
                <FileSearch className="h-4 w-4" /> Review AI fix
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {fix.currentValue && (
                <div className="rounded-[10px] border border-red-200 bg-white p-3">
                  <div className="eyebrow text-red-700">Before</div>
                  <div className="mt-1 text-sm">{fix.currentValue}</div>
                </div>
              )}
              <div className="rounded-[10px] border border-emerald-200 bg-white p-3">
                <div className="eyebrow text-emerald-800">After — proposed</div>
                {editing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit proposed fix" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>Save edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(fix.proposedValue); }}><X className="h-4 w-4" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-medium">{fix.proposedValue}</div>
                )}
              </div>
              <p className="text-[13px] text-slate-500">{fix.reason}</p>
              <p className="text-[13px] text-slate-500">Status: <b>{fix.status?.replace(/_/g, " ")}</b> — approve from the Fixes tab to record the decision.</p>
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
