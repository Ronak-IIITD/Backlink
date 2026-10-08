"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { AuthLayout } from "@/components/marketing";

function SignupForm() {
  const r = useRouter();
  const sp = useSearchParams();
  const preset = sp.get("url") || "";
  const [form, setForm] = useState({ email: "", password: "", name: "", orgName: "", websiteUrl: preset });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const s = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, orgName: form.orgName }),
      }).then((x) => x.json());
      if (!s.ok) { setErr(s.error); return; }
      // create first project immediately when URL preset (onboarding continuity)
      if (form.websiteUrl.trim()) {
        const p = await fetch("/api/projects", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ websiteUrl: form.websiteUrl.trim(), businessName: form.orgName || undefined }),
        }).then((x) => x.json());
        if (p.ok) { r.push(`/projects/${p.data.id}`); return; }
      }
      r.push("/projects?welcome=1");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Create account">
      {err && <Alert tone="error">{err}</Alert>}
      {preset && (
        <div className="rounded-[10px] border border-indigo-200 bg-indigo-50/60 px-3.5 py-2.5 text-sm">
          Auditing <b className="font-mono text-[13px]">{preset}</b> right after signup.
        </div>
      )}
      <Field label="Website" hint="The site you want the agent to work on.">
        <Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://yourbusiness.com" inputMode="url" />
      </Field>
      <Field label="Work email">
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" hint="Minimum 8 characters.">
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Your name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asha" autoComplete="name" />
        </Field>
        <Field label="Business">
          <Input value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} placeholder="Acme Co" />
        </Field>
      </div>
      <Button className="w-full" size="lg" loading={loading}>
        {form.websiteUrl.trim() ? "Create account & audit site" : "Create account"} <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}

export default function Signup() {
  return (
    <AuthLayout title="Create your account" sub="One website. A real audit in minutes. Nothing changes without your approval.">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
        <SignupForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-slate-500">Have an account? <Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">Log in</Link></p>
    </AuthLayout>
  );
}
