"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, KeyRound, Link2, Users } from "lucide-react";
import { Shell } from "@/components/shell";
import { Badge, Breadcrumb, Button, EmptyState, LoadingState, Table } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";

function useModule() {
  const [pid, setPid] = useState<string | null>(null);
  const [pname, setPname] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(async (j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      if (!j.data[0]) { setLoading(false); return; }
      setPid(j.data[0].id); setPname(j.data[0].name);
      const k = await fetch(`/api/projects/${j.data[0].id}/opportunities`).then((x) => x.json());
      if (k.ok) setData(k.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  return { pid, pname, data, loading };
}

function Crumb({ pid, pname, label }: { pid: string | null; pname: string; label: string }) {
  return <Breadcrumb items={[{ label: pname || "Site", href: pid ? `/projects/${pid}` : "/projects" }, { label }]} />;
}

export function ContentPage() {
  const { pid, pname, data, loading } = useModule();
  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Content" />
      <h1 className="page-title mt-2">Content opportunities</h1>
      <p className="body mt-1">Missing topics and thin pages, derived from pages we actually crawled — with intent, keyword, and outline.</p>
      <div className="mt-5">
        {loading ? <LoadingState lines={4} label="Finding gaps…" />
          : !pid ? <EmptyState title="No sites yet" body="Run an audit first — gaps come from your real pages." />
          : !data?.opps?.length ? <EmptyState icon={<FileText className="h-5 w-5" />} title="No gaps found yet" body="Thin pages and uncovered clusters will appear here after a scan. Add target keywords at onboarding to sharpen this." action={pid ? <Link href={`/projects/${pid}`} className="btn btn-secondary btn-sm">Open audit</Link> : undefined} />
          : (
            <Stagger className="space-y-2.5">
              {data.opps.map((o: any) => (
                <StaggerItem as="div" key={o.id}>
                  <article className="card card-hover p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold">{o.topic}</h2>
                    <Badge tone="next">{o.pageType?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-500">Intent: {o.intent || "—"} · Target: <span className="mono">{o.targetKeyword || "—"}</span></p>
                  <p className="mt-1.5 text-sm font-medium">Suggested: {o.suggestedTitle}</p>
                  <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                    {(Array.isArray(o.outline) ? o.outline : []).slice(0, 6).map((x: string, i: number) => (
                      <li key={i} className="flex gap-2"><span className="tabular-nums text-slate-300">{i + 1}.</span>{x}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" size="sm">Generate outline</Button>
                    <Button variant="ghost" size="sm">View related pages</Button>
                  </div>
                  </article>
                </StaggerItem>
              ))}
            </Stagger>
          )}
      </div>
    </Shell>
  );
}

export function KeywordsPage() {
  const { pid, pname, data, loading } = useModule();
  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Keywords" />
      <h1 className="page-title mt-2">Keywords</h1>
      <p className="body mt-1">Target terms from onboarding. Position and volume columns appear only when a rank-tracking integration is connected — we don&apos;t invent them.</p>
      <div className="mt-5">
        {loading ? <LoadingState lines={4} />
          : !data?.keywords?.length ? <EmptyState icon={<KeyRound className="h-5 w-5" />} title="No keywords yet" body="Add target keywords when creating a project. They prioritize titles, metas, and content gaps." action={<Link href="/projects" className="btn btn-secondary btn-sm">Add keywords</Link>} />
          : (
            <Table
              columns={[{ key: "term", header: "Keyword" }, { key: "note", header: "Use" }]}
              rows={data.keywords.map((k: any) => ({ term: <span className="font-medium">{k.term}</span>, note: <span className="text-slate-500">Prioritizes titles · metas · gaps</span> }))}
              rowKey={(_, i) => String(i)}
            />
          )}
      </div>
    </Shell>
  );
}

export function CompetitorsPage() {
  const { pid, pname, data, loading } = useModule();
  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Competitors" />
      <h1 className="page-title mt-2">Competitors</h1>
      <p className="body mt-1">Strategic gaps from structure we can actually fetch. No invented traffic, no fake authority scores.</p>
      <div className="mt-5 space-y-2.5">
        {loading ? <LoadingState lines={3} />
          : (
            <>
              <Stagger className="space-y-2.5">
                {(data?.competitors || []).map((c: any) => (
                  <StaggerItem as="div" key={c.id}>
                    <div className="card flex items-center gap-3 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-sm font-semibold text-slate-600">{(c.url || "?")[8]?.toUpperCase() || "C"}</span>
                      <span className="mono truncate text-sm">{c.url}</span>
                      <Badge tone="watch" className="ml-auto">tracked</Badge>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              {!data?.competitors?.length && (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No competitors tracked"
                  body="Add one competitor URL per line at onboarding — or below soon. Comparison uses only pages we fetch: service coverage, guides, and structure."
                  action={<Link href="/projects" className="btn btn-secondary btn-sm">Add competitor</Link>}
                />
              )}
              <div className="card p-4 text-sm text-slate-600">
                <b className="text-slate-900">How comparison works.</b> We fetch competitor sitemaps and key pages, then report what they cover that you don&apos;t — e.g. “Competitor A has 5 dedicated service pages; you mention them on one general page.” Metric-free until a data integration is connected.
              </div>
            </>
          )}
      </div>
    </Shell>
  );
}

export function BacklinksPage() {
  const { pid, pname, loading } = useModule();
  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Backlinks" />
      <h1 className="page-title mt-2">Backlinks</h1>
      <p className="body mt-1">Legitimate prospecting only. Referring domains, new/lost tracking, and quality-scored opportunities — verified, never bulk spam.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {[["Referring domains", "—"], ["New links", "—"], ["Lost links", "—"], ["Opportunities", "—"]].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="eyebrow">{k}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        {loading ? <LoadingState lines={3} /> : (
          <EmptyState
            icon={<Link2 className="h-5 w-5" />}
            title="Connect a link index to begin"
            body="Discovery plugs in here (Ahrefs, Moz, or Common Crawl adapters into the existing tables). Until then we show nothing rather than fake numbers. Monitoring verifies whether acquired links still exist."
            action={<span className="btn btn-secondary btn-sm">Draft outreach (gated)</span>}
          />
        )}
      </div>
    </Shell>
  );
}

// Unused import guard
void Button;
