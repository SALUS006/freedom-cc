"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not reset your password");
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="center" style={{ marginBottom: 8 }}>
        <img src="/icons/icon.svg" alt="" className="hero-mark" width={60} height={60} />
        <h1 style={{ marginTop: 12 }}>New password</h1>
      </div>

      <div className="card">
        {!token ? (
          <p className="error">This link is missing its token. Request a new one.</p>
        ) : done ? (
          <p className="notice" data-testid="reset-done">
            Password updated. Taking you to sign in…
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {error && <p className="error">{error}</p>}
            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy}>
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>

      <p className="small center muted" style={{ marginTop: 16 }}>
        <Link href="/sign-in" className="muted">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
