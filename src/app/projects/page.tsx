"use client";
import { Shell } from "@/components/shell";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Globe, Building2, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Alert, Button, Field, Input, LoadingState, Textarea } from "@/components/ui";
import { Stagger, StaggerItem, useReducedMotionFlag } from "@/components/motion";
import { easeOutExpo, duration } from "@/lib/motion";

const STEPS = ["Website", "Business", "Audience", "Competitors", "Review"];

export default function Projects() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ websiteUrl: "", businessName: "", businessType: "", targetCountry: "", targetCity: "", targetKeywords: "", competitors: "" });
  const reduce = useReducedMotionFlag();

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((j) => {
      if (!j.ok) { window.location.href = "/login"; return; }
      setProjects(j.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function valid(stepIdx: number) {
    if (stepIdx === 0) return form.websiteUrl.trim().length > 3;
    return true;
  }

  async function create() {
    setErr(""); setCreating(true);
    try {
      const payload = {
        websiteUrl: form.websiteUrl.trim(),
        businessName: form.businessName || undefined,
        businessType: form.businessType || undefined,
        targetCountry: form.targetCountry || undefined,
        targetCity: form.targetCity || undefined,
        targetKeywords: form.targetKeywords.split("\n").map((s) => s.trim()).filter(Boolean),
        competitors: form.competitors.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const j = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
      if (!j.ok) { setErr(j.error); return; }
      router.push(`/projects/${j.data.id}`);
    } finally { setCreating(false); }
  }

  if (loading) return <Shell><h1 className="page-title">Sites</h1><p className="body mt-1">Loading your sites…</p><div className="mt-5"><LoadingState lines={5} /></div></Shell>;

  const showWizard = step > 0 || form.websiteUrl !== "";

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Sites</h1>
          <p className="body mt-1">Each site is an isolated workspace with its own audit history and approval queue.</p>
        </div>
        {!showWizard && (
          <Button onClick={() => setStep(1)} variant="primary" size="sm">New site audit</Button>
        )}
      </div>

      {/* Existing sites — staggered entrance */}
      <Stagger gap={0.06} className="mt-5 space-y-2.5">
        {projects.map((p) => (
          <StaggerItem key={p.id}>
            <Link href={`/projects/${p.id}`} className="card card-hover flex items-center gap-3.5 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-sm font-semibold text-white">{(p.name || "S")[0].toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <span className="mono block truncate text-slate-500">{p.websiteUrl}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
            </Link>
          </StaggerItem>
        ))}
        {!projects.length && !showWizard && (
          <StaggerItem>
            <div className="card p-8 text-center">
              <div className="text-[15px] font-semibold">No sites yet</div>
              <p className="body mx-auto mt-1 max-w-sm">Add your first website to start an audit — free, and nothing changes without approval.</p>
            </div>
          </StaggerItem>
        )}
      </Stagger>

      {/* Wizard — steps crossfade with direction, progress fills smoothly */}
      <AnimatePresence initial={false}>
        {showWizard && (
          <motion.div
            key="wizard"
            className="card mt-5 p-6"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: duration.base, ease: easeOutExpo }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{STEPS[step - 1] || "Website"}</div>
              <div className="text-[13px] tabular-nums text-slate-500">Step {step} of {STEPS.length}</div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {STEPS.map((s, i) => (
                <motion.span
                  key={s}
                  className="h-1 flex-1 rounded-full"
                  animate={{ backgroundColor: i < step ? "#0f172a" : "#e2e8f0" }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: duration.base, ease: easeOutExpo }}
                className="mt-5 space-y-4"
              >
                {step === 1 && (
                  <Field label="Website URL" hint="We validate and SSRF-check every URL before crawling.">
                    <Input autoFocus value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://yourbusiness.com" inputMode="url" />
                  </Field>
                )}
                {step === 2 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Business name"><Input autoFocus value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Acme Co" /></Field>
                    <Field label="Business type"><Input value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="Plumbing, SaaS, dental…" /></Field>
                  </div>
                )}
                {step === 3 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Target country"><Input autoFocus value={form.targetCountry} onChange={(e) => setForm({ ...form, targetCountry: e.target.value })} placeholder="United States" /></Field>
                    <Field label="Target city (optional)"><Input value={form.targetCity} onChange={(e) => setForm({ ...form, targetCity: e.target.value })} placeholder="Austin, TX" /></Field>
                  </div>
                )}
                {step === 4 && (
                  <Field label="Competitors (one per URL per line)" hint="Only pages we can actually fetch are compared.">
                    <Textarea autoFocus value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} placeholder={"https://competitor-one.com\nhttps://competitor-two.com"} />
                  </Field>
                )}
                {step === 5 && (
                  <div className="space-y-2 text-sm">
                    <Row icon={<Globe className="h-4 w-4" />} label="Website" value={form.websiteUrl} />
                    <Row icon={<Building2 className="h-4 w-4" />} label="Business" value={form.businessName || "—"} />
                    <Row icon={<Users className="h-4 w-4" />} label="Competitors" value={form.competitors.split("\n").filter(Boolean).length + " tracked"} />
                    <div className="rounded-[10px] border border-indigo-200 bg-indigo-50/60 p-3 text-[13px] text-slate-600">
                      After creating, we crawl up to 30 pages, run 19 checks, and score transparently. Watch live progress on the next screen.
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {err && <div className="mt-4"><Alert tone="error">{err}</Alert></div>}

            <div className="mt-5 flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => (step > 1 ? setStep(step - 1) : setStep(0))}>
                <ArrowLeft className="h-4 w-4" /> {step > 1 ? "Back" : "Cancel"}
              </Button>
              {step < STEPS.length ? (
                <Button size="sm" disabled={!valid(step - 1)} onClick={() => setStep(step + 1)}>Continue <ArrowRight className="h-4 w-4" /></Button>
              ) : (
                <Button size="sm" loading={creating} onClick={create}><Check className="h-4 w-4" /> Create & start audit</Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
      <span className="flex items-center gap-2 text-slate-500">{icon}{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}
