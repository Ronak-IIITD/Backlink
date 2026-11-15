"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe, Mail, ShieldCheck, User } from "lucide-react";
import { Badge, ErrorState, LoadingState } from "@/components/ui";

export default function Settings() {
  const [data, setData] = useState<{
    user: any;
    projects: any[];
    account: any;
  } | null>(null);
  const [error, setError] = useState(false);
  async function load() {
    setError(false);
    try {
      const results = await Promise.all(
        ["/api/auth/me", "/api/projects", "/api/account"].map(async (url) => {
          const response = await fetch(url);
          const json = await response.json();
          if (response.status === 401) window.location.assign("/login");
          if (!json.ok) throw new Error("Unavailable");
          return json.data;
        }),
      );
      setData({
        user: results[0].user,
        projects: results[1],
        account: results[2],
      });
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const account = data?.account;
  return (
    <Shell>
      <p className="eyebrow mb-2 text-indigo-700">Make yourself at home</p>
      <h1 className="page-title">Your account & workspace</h1>
      <p className="body mt-2">
        Your details, pilot allowance, and the website you’re looking after.
      </p>
      <div className="mt-8">
        {error ? (
          <ErrorState
            title="Settings couldn’t be loaded"
            body="Please try again to view your latest account information."
            onRetry={load}
          />
        ) : !data ? (
          <LoadingState lines={6} />
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className="card p-6">
              <User className="h-5 w-5 text-indigo-700" />
              <h2 className="section-title mt-4">Your details</h2>
              <p className="body mt-1 text-[13px]">
                The account responsible for reviewing and approving fixes.
              </p>
              <dl className="mt-6 divide-y divide-slate-100 text-sm">
                <Row label="Name" value={data.user?.name || "Not provided"} />
                <Row label="Email" value={data.user?.email || "Unavailable"} />
              </dl>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-indigo-700"
              >
                Reset your password <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </section>
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Your pilot plan</p>
                <Badge
                  tone={
                    account.status === "active" || account.status === "trial"
                      ? "completed"
                      : "watch"
                  }
                >
                  {account.status}
                </Badge>
              </div>
              <h2 className="display mt-5 text-3xl">
                {account.status === "trial"
                  ? "Your free starting point."
                  : "A little ongoing care."}
              </h2>
              <p className="body mt-3 text-[13px]">
                {account.status === "trial"
                  ? "Your invitation includes one audit and five fix drafts."
                  : "$29 USD per month. Invoiced and renewed manually."}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <Usage
                  label="Audits used"
                  used={account.usage.audits}
                  total={account.limits.audits}
                />
                <Usage
                  label="Drafts used"
                  used={account.usage.drafts}
                  total={account.limits.drafts}
                />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                {account.period
                  ? `Current access ends ${new Date(account.period.endsAt).toLocaleDateString()}.`
                  : "Your existing results remain available."}{" "}
                No automatic renewal.
              </p>
              <Link href="/help" className="btn btn-secondary btn-sm mt-5">
                Plan & renewal help <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </section>
            <section className="card p-6">
              <Globe className="h-5 w-5 text-indigo-700" />
              <h2 className="section-title mt-4">Your website</h2>
              <p className="body mt-1 text-[13px]">
                One website, with up to 30 public pages checked per audit.
              </p>
              <div className="mt-5 space-y-3">
                {data.projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {p.websiteUrl}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-indigo-700" />
                  </Link>
                ))}
                {!data.projects.length && (
                  <Link href="/projects" className="btn btn-secondary btn-md">
                    Add your first website
                  </Link>
                )}
              </div>
            </section>
            <section className="card p-6">
              <Mail className="h-5 w-5 text-indigo-700" />
              <h2 className="section-title mt-4">Stay in the loop</h2>
              <p className="body mt-2 text-[13px]">
                Enable weekly audits and issue alerts from your website’s
                Monitoring tab. Weekly report emails can be managed in Reports.
                Paid access is required.
              </p>
              <Link
                href="/reports"
                className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-indigo-700"
              >
                Manage email reports <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </section>
            <section className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-100/60 p-6 lg:col-span-2">
              <ShieldCheck className="h-6 w-6 shrink-0 text-indigo-700" />
              <div>
                <h2 className="text-sm font-semibold">
                  Always your website. Always your decision.
                </h2>
                <p className="body mt-2 text-[13px]">
                  We check public pages, respect robots.txt, and keep approvals
                  in your workspace. You apply approved changes through your
                  website editor. For an export or account deletion, contact
                  pilot support.
                </p>
                <Link
                  href="/help"
                  className="mt-3 inline-block text-xs font-medium text-indigo-700 underline underline-offset-4"
                >
                  Coverage, privacy & support
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}
function Usage({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-medium">
        {used}
        <span className="text-sm text-slate-400"> / {total}</span>
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-indigo-600"
          style={{
            width: `${total > 0 ? Math.min(100, (used / total) * 100) : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
