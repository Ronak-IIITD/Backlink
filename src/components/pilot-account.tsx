"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function PilotAccountBanner() {
  const [account, setAccount] = useState<any>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/account")
        .then((r) => r.json())
        .then((j) => {
          if (active && j.ok) setAccount(j.data);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pilot:usage-changed", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pilot:usage-changed", refresh);
    };
  }, []);
  if (!account) return null;
  const active = ["trial", "active"].includes(account.status);
  return (
    <aside
      className={`account-strip mb-7 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b pb-4 text-xs ${active ? "border-slate-200" : "border-amber-200 text-amber-800"}`}
      aria-label="Pilot access and usage"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`rounded-md px-2 py-1 font-medium ${active ? "bg-indigo-100/70 text-indigo-800" : "bg-amber-100"}`}
        >
          {account.status === "trial"
            ? "Free pilot"
            : account.status === "active"
              ? "$29 / month pilot"
              : "Access inactive"}
        </span>
        <span className="text-slate-500">
          {account.usage.audits} / {account.limits.audits} audits{" "}
          <span className="mx-2 text-slate-300">·</span> {account.usage.drafts}{" "}
          / {account.limits.drafts} drafts
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-slate-500">
        <span>
          {active && account.period
            ? `Access until ${new Date(account.period.endsAt).toLocaleDateString()}`
            : "Existing results are still available"}
        </span>
        <Link
          className="font-medium text-indigo-700 underline underline-offset-4"
          href="/help"
        >
          {active ? "Plan & support" : "Renew access"}
        </Link>
      </div>
    </aside>
  );
}
