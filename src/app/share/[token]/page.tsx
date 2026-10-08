"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const j = await fetch(`/api/share/${params.token}`).then((r) => r.json());
      if (!j.ok) { setErr(j.error); return; }
      setData(j.data);
    } catch {
      setErr("Couldn't load this review link.");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.token]);

  async function decide(actionId: string, op: "approve" | "reject") {
    setBusy(actionId + op);
    try {
      const j = await fetch(`/api/share/${params.token}/${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId }),
      }).then((r) => r.json());
      if (j.ok) load();
      else setErr(j.error);
    } finally { setBusy(null); }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto w-full max-w-[720px] px-4 py-10">
        <div className="eyebrow">Client review — no login needed</div>
        {err && !data ? (
          <div className="card mt-4 p-6">
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="body mt-1">{err}</p>
            <Link href="/" className="btn btn-secondary btn-sm mt-4">Go home</Link>
          </div>
        ) : !data ? (
          <div className="card mt-4 p-6"><p className="body">Loading fixes…</p></div>
        ) : (
          <>
            <h1 className="page-title mt-2">{data.project?.name}</h1>
            <p className="mono mt-1 text-slate-500">{data.project?.websiteUrl}</p>
            <p className="body mt-2">Your agency asked you to review these SEO fixes. Approve what looks good — nothing changes on your site until your team applies it.</p>
            {err && <p className="mt-3 text-sm text-amber-700" role="alert">{err}</p>}
            <div className="mt-5 space-y-3">
              {(data.actions || []).map((a: any) => (
                <div key={a.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{String(a.kind).replace(/_/g, " ")}</span>
                    <span className="ml-auto rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">{String(a.status).replace(/_/g, " ")}</span>
                  </div>
                  {a.currentValue && (
                    <div className="mt-2 rounded-[10px] border border-red-200 bg-red-50/60 p-3 text-sm">{a.currentValue}</div>
                  )}
                  <div className="mt-2 rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-medium">{a.proposedValue}</div>
                  {a.reason && <p className="body mt-2">{a.reason}</p>}
                  {a.status === "awaiting_approval" && (
                    <div className="mt-3 flex gap-2">
                      <button disabled={!!busy} onClick={() => decide(a.id, "reject")} className="btn btn-secondary btn-sm">Reject</button>
                      <button disabled={!!busy} onClick={() => decide(a.id, "approve")} className="btn btn-primary btn-sm">
                        {busy === a.id + "approve" ? "Saving…" : "Approve"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!data.actions?.length && (
                <div className="card p-6 text-center">
                  <div className="font-semibold">Nothing waiting</div>
                  <p className="body mt-1">All fixes have been reviewed. Your team will handle the rest.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
