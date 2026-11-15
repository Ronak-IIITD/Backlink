import Link from "next/link";
import { ArrowUpRight, Check, Sprout } from "lucide-react";
import { MarketingNav } from "@/components/marketing";
export default function PricingPage() {
  const support = process.env.SUPPORT_EMAIL;
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-[1080px] px-5 py-14 sm:px-8 md:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow text-indigo-700">The private pilot</p>
          <h1 className="display mt-5 text-5xl sm:text-6xl">
            A small start.
            <br />
            Room to grow.
          </h1>
          <p className="body mt-5 max-w-lg">
            We’re working closely with 5–10 small businesses. Start with a free
            audit through your personal invitation, then continue when it’s
            right for you.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-[1fr_1.15fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-7 md:p-9">
            <p className="eyebrow">Your invitation includes</p>
            <h2 className="mt-5 text-3xl font-medium tracking-tight">
              A clearer starting point.
            </h2>
            <p className="body mt-4">
              Explore the workflow with one free audit and five fix drafts,
              available for 30 days.
            </p>
            <ul className="mt-7 space-y-4 text-sm text-slate-600">
              {[
                "One public website",
                "Up to 30 pages checked",
                "Prioritized issues with page evidence",
                "Review and approve each fix",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-indigo-700" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
              Already invited? Open the personal signup link in your invitation
              to get started.
            </p>
          </section>
          <article className="rounded-2xl bg-forest p-7 text-white md:p-9">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[.12em] text-[#c4d8bd]">
                Ongoing care
              </p>
              <Sprout className="h-6 w-6 text-[#c4d8bd]" />
            </div>
            <h2 className="mt-5 text-xl font-medium">SEO Agent pilot</h2>
            <p className="mt-4 text-6xl tracking-tight">
              $29{" "}
              <span className="text-sm tracking-normal text-[#c4d8bd]">
                USD / month
              </span>
            </p>
            <p className="mt-3 text-sm text-[#c4d8bd]">
              Invoiced and renewed manually. No automatic charges.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                "One website · up to 30 pages per audit",
                "8 audits and 50 fix drafts per paid period",
                "JavaScript rendering for public websites",
                "Weekly audits and fresh report emails",
                "Approved fixes checked with a new audit",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="h-4 w-4 shrink-0 text-[#c4d8bd]" />
                  {t}
                </li>
              ))}
            </ul>
            {support ? (
              <a
                className="btn btn-lg mt-9 w-full bg-[#eff3df] text-forest hover:bg-white"
                href={`mailto:${support}?subject=SEO%20Agent%20pilot`}
              >
                Ask about the pilot <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <Link
                className="btn btn-lg mt-9 w-full bg-[#eff3df] text-forest hover:bg-white"
                href="/help"
              >
                Pilot access & support <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </article>
        </div>
        <div className="mt-10 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-3">
          {[
            [
              "You make the changes",
              "Copy approved fixes into your own website editor. Nothing is published automatically.",
            ],
            [
              "Transparent coverage",
              "Scores describe the public pages checked. Partial audits are labelled, and rankings aren’t guaranteed.",
            ],
            [
              "A flexible commitment",
              "Weekly audits use the same allowance. Existing results stay readable when access ends.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="text-sm font-semibold">{t}</h3>
              <p className="body mt-2 text-[13px]">{b}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
