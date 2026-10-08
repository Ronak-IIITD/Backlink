"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, KeyRound, Link2, Users } from "lucide-react";
import { Shell } from "@/components/shell";
import { Badge, Breadcrumb, Button, EmptyState, Field, Input, LoadingState, Table, toast } from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";
import { preferredProject } from "@/lib/project-selection";

function useModule() {
  const [pid, setPid] = useState<string | null>(null);
  const [pname, setPname] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(async (j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      const project = preferredProject<any>(j.data);
      if (!project) { setLoading(false); return; }
      setPid(project.id); setPname(project.name);
      const k = await fetch(`/api/projects/${project.id}/opportunities`).then((x) => x.json());
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
                    <Button variant="secondary" size="sm" onClick={() => {
                      const text = [o.suggestedTitle, ...(o.outline || []).map((item: string, i: number) => `${i + 1}. ${item}`)].filter(Boolean).join("\n\n");
                      navigator.clipboard.writeText(text).then(() => toast("Outline copied", "Paste it into your content brief.")).catch(() => toast("Couldn't copy outline", "Clipboard access is unavailable in this browser."));
                    }}>Copy outline</Button>
                    <Link href={pid ? `/projects/${pid}` : "/projects"} className="btn btn-ghost btn-sm">Open audit</Link>
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
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setCompetitors(data?.competitors || []), [data?.competitors]);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!pid || !url.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await fetch(`/api/projects/${pid}/competitors`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }),
      }).then((r) => r.json());
      if (!result.ok) { setError(result.error); return; }
      setCompetitors((current) => [...current, result.data]);
      setUrl("");
      toast("Competitor added", "Saved to this site's workspace.");
    } catch { setError("Couldn't add competitor."); }
    finally { setSaving(false); }
  }

  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Competitors" />
      <h1 className="page-title mt-2">Competitors</h1>
      <p className="body mt-1">Strategic gaps from structure we can actually fetch. No invented traffic, no fake authority scores.</p>
      <div className="mt-5 space-y-2.5">
        {!loading && pid && <form onSubmit={addCompetitor} className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1"><Field label="Competitor website">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://competitor.com" inputMode="url" />
          </Field></div>
          <Button type="submit" size="sm" loading={saving} className="sm:mt-6">Add competitor</Button>
        </form>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {loading ? <LoadingState lines={3} />
          : (
            <>
              <Stagger className="space-y-2.5">
                {competitors.map((c: any) => (
                  <StaggerItem as="div" key={c.id}>
                    <div className="card flex items-center gap-3 p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-sm font-semibold text-slate-600">{(c.url || "?")[8]?.toUpperCase() || "C"}</span>
                      <span className="mono truncate text-sm">{c.url}</span>
                      <Badge tone="watch" className="ml-auto">added</Badge>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
              {!competitors.length && (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No competitors added"
                  body={pid ? `Add a competitor for ${pname}. URLs are saved to this site; coverage comparisons are not available yet.` : "Create a site before adding competitors."}
                />
              )}
              {!!competitors.length && <p className="body">Competitor URLs are saved to {pname}. Coverage comparisons are not available yet.</p>}
            </>
          )}
      </div>
    </Shell>
  );
}

export function BacklinksPage() {
  const { pid, pname, data, loading } = useModule();
  const backlinks = data?.backlinks || [];
  const opportunities = data?.backlinkOpps || [];
  return (
    <Shell>
      <Crumb pid={pid} pname={pname} label="Backlinks" />
      <h1 className="page-title mt-2">Backlinks</h1>
      <p className="body mt-1">Verified links and opportunities for the selected site.</p>
      <div className="mt-4">
        {loading ? <LoadingState lines={3} /> : backlinks.length || opportunities.length ? <div className="divide-y divide-slate-100 border-t border-slate-200">
          {[...backlinks.map((row: any) => ({ ...row, kind: "Backlink" })), ...opportunities.map((row: any) => ({ ...row, kind: "Opportunity" }))].map((row: any) => (
            <div key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <Badge tone={row.kind === "Backlink" ? "completed" : "next"}>{row.kind}</Badge>
              <span className="mono min-w-0 flex-1 truncate">{row.sourceUrl || row.url || row.domain}</span>
              <span className="text-slate-500">{row.status || row.oppType || "—"}</span>
            </div>
          ))}
        </div> : <EmptyState
          icon={<Link2 className="h-5 w-5" />}
          title="No backlink data yet"
          body="Connect a link data provider to see referring domains and link opportunities here. No metrics are shown until a source is connected."
        />}
      </div>
    </Shell>
  );
}

/*
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
*/
