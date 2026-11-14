"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function PilotAccountBanner() {
  const [account, setAccount] = useState<any>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { fetch("/api/account").then((r) => r.json()).then((j) => { if (active && j.ok) setAccount(j.data); }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh); window.addEventListener("pilot:usage-changed", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pilot:usage-changed", refresh); };
  }, []);
  if (!account) return null;
  const active = ["trial", "active"].includes(account.status);
  return <aside className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" aria-label="Pilot access and usage">
    <p className="font-medium">{account.status === "trial" ? "Free pilot audit" : account.status === "active" ? "$29/month private pilot" : "Pilot access is inactive"}</p>
    <p className="mt-1 text-slate-600">{account.usage.audits}/{account.limits.audits} audits · {account.usage.drafts}/{account.limits.drafts} drafts · one website · 30 pages per audit</p>
    <p className="mt-1 text-slate-500">{active && account.period ? `Access until ${new Date(account.period.endsAt).toLocaleDateString()}. ` : "Your existing results remain available. "}
      {account.status === "trial" ? "Ongoing audits and weekly monitoring require paid activation. " : "Renewal is manual. "}
      {account.supportEmail ? <a className="underline" href={`mailto:${account.supportEmail}`}>Contact support</a> : <Link className="underline" href="/help">Get help</Link>}
    </p>
  </aside>;
}
