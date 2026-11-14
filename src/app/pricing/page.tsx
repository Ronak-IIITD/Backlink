import Link from "next/link";
import { MarketingNav } from "@/components/marketing";
export default function PricingPage() {
  const support = process.env.SUPPORT_EMAIL;
  return <div className="min-h-screen bg-white text-slate-900"><MarketingNav /><main className="mx-auto max-w-3xl px-5 py-16">
    <p className="eyebrow">Private pilot · 5–10 small businesses</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Find issues. Review fixes. Verify progress.</h1>
    <p className="body mt-4">Start with one free audit and five fix drafts through your invitation. Continue for $29 USD per month, invoiced and renewed manually.</p>
    <article className="card mt-8 p-7"><h2 className="section-title">SEO Agent pilot</h2><p className="mt-3 text-4xl font-semibold">$29 <span className="text-base font-normal text-slate-500">USD/month</span></p>
      <ul className="mt-5 space-y-2 text-sm"><li>One website · up to 30 pages per audit</li><li>Eight audits and 50 fix drafts per paid monthly access period</li><li>JavaScript rendering for public websites</li><li>Weekly audits and fresh report emails within your allowance</li><li>Copy approved fixes into your website and verify them by rescan</li></ul>
      <p className="body mt-5">Invitation-only. No automatic charge or renewal. Your site is updated manually. Audit scores describe the pages checked and do not guarantee rankings.</p>
      {support ? <a className="btn btn-primary btn-md mt-5" href={`mailto:${support}?subject=SEO%20Agent%20pilot`}>Ask about the pilot</a> : <Link className="btn btn-primary btn-md mt-5" href="/help">Pilot access and support</Link>}
    </article><p className="body mt-5">Already invited? Use the personal signup link provided with your invitation.</p>
  </main></div>;
}
