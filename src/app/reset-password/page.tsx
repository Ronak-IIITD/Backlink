"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { AuthLayout } from "@/components/marketing";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!token) { setError("This reset link is missing its token."); return; }
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Could not update password."); return; }
      router.replace("/login");
    } catch {
      setError("Could not reach the server. Try again shortly.");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Choose new password">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="New password" hint="Use at least 12 characters.">
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={100} required autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <Input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={100} required autoComplete="new-password" />
      </Field>
      <Button className="w-full" size="lg" loading={loading}>Update password</Button>
    </form>
  );
}

export default function ResetPassword() {
  return (
    <AuthLayout title="Choose a new password" sub="Reset links expire after 30 minutes and work once.">
      <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}><ResetForm /></Suspense>
      <p className="mt-4 text-center text-sm text-slate-500"><Link href="/login" className="font-medium text-slate-900 underline underline-offset-2">Back to log in</Link></p>
    </AuthLayout>
  );
}
