"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { AuthLayout } from "@/components/marketing";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Could not request a reset link."); return; }
      setMessage(result.data.message);
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout title="Reset your password" sub="We will email a secure, single-use reset link if an account matches.">
      <form onSubmit={submit} className="space-y-4" aria-label="Request password reset">
        {error && <Alert tone="error">{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        <Field label="Email">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" />
        </Field>
        <Button className="w-full" size="lg" loading={loading}>Send reset link</Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500"><Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">Back to log in</Link></p>
    </AuthLayout>
  );
}
