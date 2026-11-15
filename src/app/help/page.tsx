import Link from "next/link";
import {
  ArrowUpRight,
  FileCheck2,
  LifeBuoy,
  ScanLine,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { Shell } from "@/components/shell";
export default function Help() {
  const support = process.env.SUPPORT_EMAIL;
  const topics = [
    {
      icon: ScanLine,
      title: "Your first audit",
      body: "Use the personal invitation link to create your account. Add one public website and choose JavaScript rendering if its content loads through scripts. Your trial includes one audit of up to 30 pages and five fix drafts, available for 30 days.",
    },
    {
      icon: FileCheck2,
      title: "Approve, update, and verify",
      body: "Open an issue, review the draft and its target URL, then approve it. Copy the approved value into your website editor. Select “I updated my website” after saving. A later successful audit checks the page before marking the original issue resolved.",
    },
    {
      icon: Sprout,
      title: "Paid access and renewal",
      body: "The pilot costs $29 USD per month for one website, eight audits, and 50 fix drafts per paid access period. Weekly audits use the same allowance. Payments and renewals are handled manually through support. There are no automatic charges. Existing results remain readable when access ends.",
    },
    {
      icon: ShieldCheck,
      title: "Coverage and privacy",
      body: "Audits inspect public pages and respect robots.txt. Partial coverage is labelled. JavaScript rendering uses ScrapingBee; configured AI services receive selected page evidence to draft recommendations. Private pages, website logins, and ranking guarantees are outside the pilot. Results are retained for 90 days after access expires. Request an export or account deletion through support.",
    },
  ];
  return (
    <Shell>
      <p className="eyebrow mb-2 text-indigo-700">
        A little help along the way
      </p>
      <h1 className="page-title">Let’s keep you moving.</h1>
      <p className="body mt-2">
        How the pilot works, what to expect, and where to get a hand.
      </p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {topics.map((t) => (
            <section key={t.title} className="card p-6">
              <div className="flex items-center gap-3">
                <t.icon className="h-5 w-5 text-indigo-700" strokeWidth={1.6} />
                <h2 className="section-title">{t.title}</h2>
              </div>
              <p className="body mt-4 text-[13px]">{t.body}</p>
            </section>
          ))}
        </div>
        <aside className="rounded-2xl bg-forest p-7 text-white lg:sticky lg:top-8">
          <LifeBuoy className="h-7 w-7 text-[#c4d8bd]" strokeWidth={1.5} />
          <h2 className="display mt-6 text-3xl">
            A person on
            <br />
            the other side.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#d2dfce]">
            {support
              ? "Need help with your audit, access, or a fix? Get in touch with pilot support."
              : "Reply to the person who provided your invitation for help with your audit or access. Direct support details will be supplied before paid activation."}
          </p>
          {support && (
            <a
              className="btn btn-md mt-6 w-full break-all bg-[#eff3df] text-forest hover:bg-white"
              href={`mailto:${support}`}
            >
              Contact support <ArrowUpRight className="h-4 w-4 shrink-0" />
            </a>
          )}
          <Link
            href="/pricing"
            className="mt-6 flex items-center gap-2 text-xs text-[#d2dfce] underline underline-offset-4"
          >
            View the pilot offer <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </aside>
      </div>
    </Shell>
  );
}
