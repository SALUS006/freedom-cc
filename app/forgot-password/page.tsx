"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSent(true);
    setBusy(false);
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="center" style={{ marginBottom: 8 }}>
        <img src="/icons/icon.svg" alt="" className="hero-mark" width={60} height={60} />
        <h1 style={{ marginTop: 12 }}>Reset password</h1>
      </div>

      <div className="card">
        {sent ? (
          <div data-testid="forgot-sent">
            <p className="notice">
              If <strong>{email}</strong> is registered, a reset link is on its way. It expires in an
              hour.
            </p>
            <Link className="btn btn-ghost btn-block" href="/sign-in" style={{ marginTop: 12 }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>

      <p className="small center muted" style={{ marginTop: 16 }}>
        No email set up for your club? Ask your admin to reset it for you.
      </p>
    </div>
  );
}
