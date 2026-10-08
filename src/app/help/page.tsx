import Link from "next/link";
import { MarketingNav } from "@/components/marketing";
import { Stagger, StaggerItem, Reveal } from "@/components/motion";

const topics = [
  { title: "How scans work", copy: "The crawler stays on the same domain, respects robots.txt, and captures page evidence — status, titles, metas, headings, links, images — to score technical and on-page issues." },
  { title: "Why a fix is recommended", copy: "Each recommendation pairs plain-language impact with the concrete title, meta, link, page, or content change behind it. Severity reflects blast radius, not vanity." },
  { title: "Approving changes", copy: "Generated fixes sit in Awaiting approval until you accept or reject. Every decision is recorded with reviewer and timestamp in the audit log." },
  { title: "Data boundaries", copy: "We don't invent competitor metrics, rankings, or traffic. Empty states stay empty until real crawl or integration data exists." },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav />
      <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-12">
        <p className="eyebrow">Help center</p>
        <h1 className="mt-2 max-w-2xl text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">Understand the crawl before you approve the fix.</h1>
        <p className="body mt-3 max-w-xl text-[16px]">Short guides for interpreting audit evidence, reviewing generated changes, and keeping the agent inside your trust boundaries.</p>
        <Reveal delay={0.15}>
          <div className="card flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Quick answer — no report yet?</div>
            <p className="body mt-0.5">A missing report means no completed crawl exists. Open Sites, start an audit, and watch live progress until it completes.</p>
          </div>
          <Link href="/projects" className="btn btn-secondary btn-md shrink-0">Open sites</Link>
          </div>
        </Reveal>
        <Stagger gap={0.07} className="mt-6 grid gap-4 md:grid-cols-2">
          {topics.map((t) => (
            <StaggerItem as="div" key={t.title}>
              <article className="card card-hover p-5">
                <h2 className="text-[15px] font-semibold">{t.title}</h2>
                <p className="body mt-1.5">{t.copy}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </main>
    </div>
  );
}
