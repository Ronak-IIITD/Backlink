"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { AuthLayout } from "@/components/marketing";

export default function Login() {
  const r = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const j = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      }).then((x) => x.json());
      if (!j.ok) { setErr(j.error); return; }
      r.push("/dashboard");
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout title="Welcome back" sub="Your approval queue and site health are waiting.">
      <form onSubmit={submit} className="space-y-4" aria-label="Log in">
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" />
        </Field>
        <Button className="w-full" size="lg" loading={loading}>Log in</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">No account? <Link href="/signup" className="font-medium text-slate-900 underline underline-offset-2">Sign up</Link></p>
    </AuthLayout>
  );
}
