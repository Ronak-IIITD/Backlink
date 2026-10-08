import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingNav } from "@/components/marketing";
import { Stagger, StaggerItem, Reveal } from "@/components/motion";

const plans = [
  { name: "Starter", price: "$29", per: "/mo", copy: "One owner, one clear issue queue.", features: ["1 website", "30-page crawls", "AI-drafted fixes", "Approval history"], cta: "Start audit" },
  { name: "Growth", price: "$79", per: "/mo", copy: "Teams approving fixes every week.", features: ["5 websites", "Priority ranking", "Content opportunities", "Exportable reports"], cta: "Start audit", featured: true },
  { name: "Agency", price: "Custom", per: "", copy: "Multi-client workflows and CMS handoff.", features: ["Client workspaces", "Shared approval queue", "Limit tuning", "Implementation support"], cta: "Talk to us" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav />
      <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-12">
        <Reveal>
          <p className="eyebrow">Pricing</p>
          <h1 className="mt-2 max-w-2xl text-[36px] font-semibold leading-tight tracking-tight md:text-[44px]">Pay for fixes shipped, not metrics viewed.</h1>
          <p className="body mt-3 max-w-xl text-[16px]">Every plan includes crawled evidence, plain-language explanations, and an approval queue. No rank guarantees, no invented data.</p>
        </Reveal>
        <Stagger gap={0.09} delay={0.1} className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <StaggerItem key={p.name} className={p.featured ? "md:-mt-3 md:mb-3" : ""}>
              <div className={`p-6 ${p.featured ? "rounded-2xl border-2 border-slate-900 bg-slate-900 text-white" : "card"}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">{p.name}</h2>
                {p.featured && <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-medium">Most popular</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                <span className={p.featured ? "text-slate-300" : "text-slate-500"}>{p.per}</span>
              </div>
              <p className={`mt-2 text-sm ${p.featured ? "text-slate-300" : "text-slate-500"}`}>{p.copy}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className={`h-4 w-4 shrink-0 ${p.featured ? "text-emerald-300" : "text-emerald-600"}`} aria-hidden />{f}</li>
                ))}
              </ul>
              <Link href="/signup" className={`btn mt-6 w-full ${p.featured ? "bg-white text-slate-900 hover:bg-slate-100" : "btn-secondary"}`}>{p.cta}</Link>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.2}><p className="body mt-6 text-center">First audit is free · Cancel anytime · Your data stays isolated per workspace</p></Reveal>
      </main>
    </div>
  );
}
