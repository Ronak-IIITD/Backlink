import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileCheck2,
  ListFilter,
  ScanLine,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <div className="overflow-hidden bg-paper">
      <MarketingNav />
      <main>
        <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-16 pt-14 sm:px-8 md:py-24 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[.13em] text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" /> A
              private pilot for small businesses
            </p>
            <h1 className="display max-w-xl text-[54px] sm:text-[76px] lg:text-[80px]">
              Good SEO.
              <br />A clear path
              <br />
              <span className="italic text-indigo-700">forward.</span>
            </h1>
            <p className="mt-7 max-w-md text-[16px] leading-7 text-slate-600">
              Know what’s holding your website back, what to fix first, and how
              to make it better. One practical step at a time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pricing" className="btn btn-primary btn-lg">
                Explore the pilot <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="#how" className="btn btn-secondary btn-lg">
                See how it works
              </Link>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4" /> Invitation-only. Every change
              stays in your hands.
            </p>
          </div>
          <div id="product" className="relative scroll-mt-28">
            <div
              className="marketing-grid absolute -inset-8 rounded-full opacity-75"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_70px_-30px_#234d3c40]">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Sprout className="h-4 w-4 text-indigo-700" /> Your website,
                  at a glance
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-medium tracking-wider text-slate-500">
                  SAMPLE DATA
                </span>
              </div>
              <div className="p-5 sm:p-7">
                <div className="flex items-center gap-5">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-[7px] border-indigo-100 border-t-indigo-600 border-r-indigo-600">
                    <span className="text-3xl font-medium tracking-tight">
                      72
                      <span className="block text-center text-[10px] font-normal leading-4 text-slate-500">
                        OUT OF 100
                      </span>
                    </span>
                  </div>
                  <div>
                    <p className="eyebrow">SEO health</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight">
                      A little care goes a long way.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      24 public pages checked
                    </p>
                  </div>
                </div>
                <div className="mt-7 flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm font-semibold">Your next steps</span>
                  <ListFilter className="h-4 w-4 text-slate-400" />
                </div>
                {[
                  ["Write unique page titles", "4 pages", "High priority"],
                  ["Add helpful image descriptions", "8 pages", "Opportunity"],
                  [
                    "Clarify your homepage description",
                    "1 page",
                    "Draft ready",
                  ],
                ].map(([title, pages, status], i) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 border-b border-slate-100 py-4 last:border-0"
                  >
                    <span className="font-mono text-xs text-slate-400">
                      0{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{title}</p>
                      <p className="mt-1 text-xs text-slate-500">{pages}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${i === 0 ? "bg-amber-50 text-amber-800" : "bg-indigo-50 text-indigo-700"}`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Clear
                  recommendations. Review before applying.
                </div>
              </div>
            </div>
            <p className="relative mt-4 text-center text-[11px] text-slate-500">
              An illustration of your workspace. Your results will reflect your
              audit.
            </p>
          </div>
        </section>
        <div className="border-y border-slate-200 bg-[#eeeee5]/60">
          <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-x-8 gap-y-4 px-6 py-6 text-[13px] text-slate-600">
            {[
              "Built for small business",
              "Evidence behind every issue",
              "You approve every fix",
              "Progress checked by a new audit",
            ].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-indigo-700" />
                {t}
              </span>
            ))}
          </div>
        </div>
        <section
          id="how"
          className="mx-auto max-w-[1240px] scroll-mt-16 px-5 py-20 sm:px-8 md:py-28"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-indigo-700">
                Less guesswork. More direction.
              </p>
              <h2 className="display mt-4 text-4xl sm:text-5xl">
                From “where do I start?”
                <br />
                to your next small win.
              </h2>
            </div>
            <p className="body max-w-xs">
              A repeatable way to look after your website, even when SEO isn’t
              your day job.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: ScanLine,
                title: "See the whole picture.",
                text: "Start an audit of up to 30 public pages. See what was checked, where issues appear, and what the findings mean.",
              },
              {
                icon: FileCheck2,
                title: "Make a considered change.",
                text: "Review a suggested fix and its target page. Approve the draft, then copy it into your website editor when you’re ready.",
              },
              {
                icon: Sprout,
                title: "Keep moving forward.",
                text: "Run a fresh audit after your update to check the result. Paid access adds weekly monitoring within your allowance.",
              },
            ].map((s, i) => (
              <article key={s.title} className="border-t border-slate-300 pt-6">
                <div className="flex items-center justify-between">
                  <s.icon
                    className="h-6 w-6 text-indigo-700"
                    strokeWidth={1.5}
                  />
                  <span className="font-mono text-xs text-slate-400">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-medium tracking-tight">
                  {s.title}
                </h3>
                <p className="body mt-3">{s.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mx-4 mb-6 rounded-[24px] bg-forest px-6 py-16 text-white sm:mx-8 md:py-20">
          <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-10">
            <div>
              <p className="text-xs uppercase tracking-[.15em] text-[#c4d8bd]">
                Start with clarity
              </p>
              <h2 className="display mt-4 text-4xl sm:text-6xl">
                Your next step starts
                <br />
                with one audit.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#d2dfce]">
                Your invitation includes one free audit and five fix drafts.
                Continue for $29 USD/month with manual renewal.
              </p>
            </div>
            <Link
              href="/pricing"
              className="btn btn-lg bg-[#eff3df] text-forest hover:bg-white"
            >
              Find out about the pilot <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-6 py-10">
        <Link href="/">
          <Brand />
        </Link>
        <p className="text-xs text-slate-500">
          Thoughtful improvements. No ranking promises.
        </p>
        <div className="flex gap-6 text-xs text-slate-600">
          <Link href="/pricing">Pricing</Link>
          <Link href="/help">Help & privacy</Link>
          <Link href="/login">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
