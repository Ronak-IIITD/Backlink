"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Play } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { MarketingNav } from "@/components/marketing";
import { Stagger, StaggerItem, Reveal, CountUp, AnimatedProgress } from "@/components/motion";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Gentle depth on the product preview: it rises slower than the page around it.
  const { scrollYProgress } = useScroll({ target: previewRef, offset: ["start end", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 14, reduce ? 0 : -14]);

  function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { setErr("Enter your website to begin."); return; }
    router.push(`/signup?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <MarketingNav links={[{ href: "#product", label: "Product" }, { href: "#how", label: "How it works" }, { href: "#agent", label: "Agent" }, { href: "/pricing", label: "Pricing" }]} />

      <main>
        {/* Hero — one choreographed entrance, then stillness */}
        <section className="mx-auto max-w-[1120px] px-5 pb-10 pt-14 md:pt-20">
          <Stagger gap={0.08} delay={0.05} className="max-w-2xl">
            <StaggerItem>
              <p className="eyebrow">AI SEO employee — analyze → fix → monitor</p>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] md:text-[60px]">
                Give us your website.<br />We find what&apos;s holding it back.
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="body mt-4 max-w-xl text-[16px]">
                Audit your site, uncover growth opportunities, generate fixes, and continuously
                improve search visibility from one place. You approve every change.
              </p>
            </StaggerItem>
            <StaggerItem className="mt-7">
              <form onSubmit={analyze} className="max-w-xl" aria-label="Analyze your website">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setErr(""); }}
                    placeholder="https://yourbusiness.com"
                    inputMode="url"
                    aria-label="Your website URL"
                    className="h-12 text-[15px]"
                  />
                  <Button type="submit" size="lg" className="h-12 shrink-0 px-6">
                    Analyze my website <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                {err ? <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>
                  : <p className="mt-2 text-[13px] text-slate-500">Free first audit · 30 pages · No credit card · Nothing changes without approval</p>}
              </form>
            </StaggerItem>
          </Stagger>

          {/* Sample product preview */}
          <motion.div ref={previewRef} style={reduce ? undefined : { y: previewY }}>
            <Reveal delay={0.15} y={20}>
              <div id="product" className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md scroll-mt-20">
                <PreviewBar />
                <div className="grid md:grid-cols-[240px_1fr]">
                  <div className="hidden border-r border-slate-200 bg-slate-50/60 p-4 md:block">
                    <div className="space-y-1 text-[13px]">
                      {["Overview", "Issues", "AI Agent", "Content", "Reports"].map((n, i) => (
                        <div key={n} className={`rounded-lg px-3 py-1.5 ${i === 0 ? "bg-white font-medium shadow-sm ring-1 ring-slate-200" : "text-slate-500"}`}>{n}</div>
                      ))}
                    </div>
                  </div>
                  <div className="p-5 md:p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="eyebrow">Example audit</div>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">SAMPLE DATA</span>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="eyebrow">SEO health</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <CountUp to={72} className="text-4xl font-semibold tabular-nums tracking-tight" />
                          <span className="text-slate-400">/100</span>
                        </div>
                      </div>
                      <div className="flex gap-5 text-sm">
                        <span><CountUp to={4} className="font-semibold tabular-nums" /> <span className="text-slate-500">critical</span></span>
                        <span><CountUp to={11} className="font-semibold tabular-nums" /> <span className="text-slate-500">high priority</span></span>
                        <span><CountUp to={9} className="font-semibold tabular-nums" /> <span className="text-slate-500">opportunities</span></span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {[
                        ["Fix 8 broken internal links", "Critical · Redirect or update targets", "Review"],
                        ["Add meta descriptions to 6 pages", "High · Drafted, awaiting approval", "Review fix"],
                        ["Create 3 missing topic pages", "Opportunity · Outline ready", "View"],
                      ].map(([t, s, cta], i) => (
                        <Reveal key={t} delay={0.3 + i * 0.08} y={10}>
                          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors duration-150 hover:border-slate-300">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{t}</div>
                              <div className="text-[13px] text-slate-500">{s}</div>
                            </div>
                            <span className="btn btn-secondary btn-sm shrink-0">{cta}</span>
                          </div>
                        </Reveal>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </motion.div>
        </section>

        {/* Problem */}
        <section className="border-y border-slate-200 bg-slate-50/60">
          <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-14 md:grid-cols-2">
            <Reveal>
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight">Most SEO tools tell you what&apos;s wrong. They don&apos;t do the work.</h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="space-y-4 text-[15px] leading-7 text-slate-600">
                <p>You get a 400-row export, three conflicting scores, and a Sunday lost to meta tags. The audit isn&apos;t the job — the fix is.</p>
                <p className="font-medium text-slate-900">SEO Agent is built around an approval queue: evidence, plain-language reasoning, a drafted fix, and your decision.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-[1120px] px-5 py-14 scroll-mt-16">
          <Reveal><h2 className="section-title text-[22px]">How it works</h2></Reveal>
          <Stagger as="ol" gap={0.08} className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-4">
            {[["01 — Connect", "Enter your URL. We validate it and create an isolated project."],
              ["02 — Analyze", "We crawl up to 30 pages, run 19 checks, and score transparently."],
              ["03 — Fix", "Review drafted titles, metas, and structure. Approve, edit, or reject."],
              ["04 — Grow", "Rescan to watch health rise. Content gaps become outlines."]].map(([t, d]) => (
              <StaggerItem as="li" key={t} className="bg-white p-5">
                <div className="mono text-indigo-700">{t.split(" — ")[0]}</div>
                <div className="mt-1 font-semibold">{t.split(" — ")[1]}</div>
                <p className="body mt-1.5">{d}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* Agent — hero feature as action stream, not chatbot */}
        <section id="agent" className="mx-auto max-w-[1120px] px-5 pb-14 scroll-mt-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <Reveal>
              <div>
                <p className="eyebrow">The agent</p>
                <h2 className="mt-2 text-[28px] font-semibold tracking-tight">A workspace of actions, not a chat window.</h2>
                <p className="body mt-3">The agent reasons in public: what it scanned, what it found, what it drafted, and what needs you. No “Hello! How can I help?”</p>
                <div className="mt-5 flex gap-2">
                  <Link href="/signup" className="btn btn-primary btn-md">Analyze my website</Link>
                  <a href="#product" className="btn btn-secondary btn-md"><Play className="h-4 w-4" /> See how it works</a>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="card overflow-hidden" aria-label="Agent activity example">
                <div className="border-b border-slate-200 px-5 py-3.5">
                  <div className="text-sm font-semibold">Task — Improve on-page SEO</div>
                  <div className="mt-2"><AnimatedProgress value={64} tone="accent" /></div>
                  <div className="mt-1.5 text-[13px] tabular-nums text-slate-500">Progress 7 / 11 pages</div>
                </div>
                <ol className="space-y-0 px-5 py-2 text-sm">
                  {[
                    ["Analyzed homepage + 10 pages", "done", "34 pages discovered · 29 analyzed"],
                    ["Found 7 weak titles", "done", "Evidence attached per URL"],
                    ["Generated replacements", "done", "50–60 chars, topic-first"],
                    ["4 changes waiting for approval", "now", "Nothing applied yet"],
                  ].map(([t, s, d], i) => (
                    <Reveal as="li" key={t} delay={0.2 + i * 0.08} y={8} className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s === "now" ? "bg-indigo-600" : "bg-emerald-500"}`} aria-hidden />
                      <div><div className="font-medium">{t}</div><div className="text-[13px] text-slate-500">{d}</div></div>
                    </Reveal>
                  ))}
                </ol>
                <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">
                  <span className="btn btn-accent btn-sm">Review changes</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Features — editorial, alternating */}
        <section className="mx-auto max-w-[1120px] space-y-12 px-5 pb-14">
          <Feature flip title="Technical SEO with evidence" body="Broken pages, HTTPS, speed, canonicals, indexability — each issue cites the exact crawled URLs and counts, so engineering never guesses." points={["Redirect chains traced to 5 hops", "Orphan + thin-page detection", "Rescan after every fix"]} />
          <Feature title="Fixes drafted, never auto-shipped" body="Titles, metas, H1s, alt text, and FAQ scaffolds arrive as before/after diffs with reasoning and confidence. Approve, edit inline, or reject — all recorded." points={["Copy-paste-ready replacements", "Structured change payloads", "Full audit history"]} />
          <Feature flip title="Content gaps from your real site" body="Thin pages and missing clusters become topics with intent, target keyword, outline, and internal-link targets — tied to pages we actually crawled." points={["Question-shaped outlines", "Internal-link suggestions", "No invented search volume"]} />
        </section>

        {/* Trust — honest, no fake logos */}
        <section className="border-y border-slate-200 bg-slate-50/60">
          <div className="mx-auto max-w-[1120px] px-5 py-12">
            <Reveal><h2 className="section-title text-[22px]">Trust is the feature</h2></Reveal>
            <Stagger gap={0.08} className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-3">
              {[["Real crawls only", "Every issue links to fetched pages, status codes, and hashes. If we didn't fetch it, we don't claim it."],
                ["Approval-gated", "The agent cannot change your site silently. Draft → await approval → approved → applied."],
                ["No rank promises", "We show what improved and what needs attention. We never promise #1 or invent traffic."]].map(([t, d]) => (
                <StaggerItem key={t} className="bg-white p-5">
                  <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4 text-emerald-600" aria-hidden />{t}</div>
                  <p className="body mt-1.5">{d}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-[1120px] px-5 py-16 text-center">
          <Reveal>
            <h2 className="mx-auto max-w-xl text-[32px] font-semibold tracking-tight">Fix the SEO problems that matter most.</h2>
            <p className="body mx-auto mt-2 max-w-md">Start with one website. See your health score and first fixes in minutes.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/signup" className="btn btn-primary btn-lg">Analyze my website</Link>
              <Link href="/login" className="btn btn-secondary btn-lg">Log in</Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-4 px-5 py-6 text-[13px] text-slate-500">
          <span className="font-semibold text-slate-900">SEO Agent</span>
          <span>Analyze · Recommend · Generate · Execute · Monitor</span>
          <span className="ml-auto flex gap-4">
            <Link href="/pricing" className="transition-colors hover:text-slate-900">Pricing</Link>
            <Link href="/help" className="transition-colors hover:text-slate-900">Help</Link>
            <Link href="/login" className="transition-colors hover:text-slate-900">Log in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function PreviewBar() {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5" aria-hidden>
      <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
      <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
      <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
      <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-xs text-slate-400 ring-1 ring-slate-200">app.seo-agent.com/overview</span>
    </div>
  );
}

function Feature({ title, body, points, flip }: { title: string; body: string; points: string[]; flip?: boolean }) {
  return (
    <div className="grid items-center gap-6 md:grid-cols-2">
      <Reveal className={flip ? "md:order-2" : ""}>
        <div>
          <h3 className="text-[22px] font-semibold tracking-tight">{title}</h3>
          <p className="body mt-2 max-w-md">{body}</p>
          <ul className="mt-4 space-y-2">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-emerald-600" aria-hidden />{p}</li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={0.1} className={flip ? "md:order-1" : ""}>
        <div className="card p-5" aria-hidden="true">
          <div className="space-y-2">
            <div className="h-3 w-2/5 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
            <div className="ai-chip mt-2 w-fit">Generated by your SEO agent</div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
