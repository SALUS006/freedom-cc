"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Consent } from "@/app/components/Consent";

export default function Onboarding() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; consent_at: string | null } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.consent_at) {
          router.replace("/");
          return;
        }
        setMe(d);
      })
      .catch(() => setError("Could not load your account"));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not finish sign-up");
      router.push("/profile?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (error && !me) return <p className="error">{error}</p>;
  if (!me) return <p className="muted">Loading…</p>;

  return (
    <div style={{ paddingTop: "calc(var(--safe-t) + 16px)" }}>
      <div className="center" style={{ marginBottom: 6 }}>
        <img src="/icons/icon.svg" alt="" className="hero-mark" width={60} height={60} />
        <h1 style={{ marginTop: 12 }}>Welcome, {me.name.split(" ")[0]}</h1>
        <p className="muted small">Set a password and accept the club terms to get started.</p>
      </div>

      <div className="card">
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
          <Consent checked={consent} onChange={setConsent} />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy || !consent}>
            {busy ? "Finishing…" : "Finish sign-up"}
          </button>
        </form>
      </div>
    </div>
  );
}
