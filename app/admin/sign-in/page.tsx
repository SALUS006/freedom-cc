"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign in");
      if (data.needsOnboarding) router.push("/onboarding");
      else if (data.isAdmin) router.push("/admin");
      else router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="center" style={{ marginBottom: 8 }}>
        <img src="/icons/icon.svg" alt="" className="hero-mark" width={64} height={64} />
        <h1 style={{ marginTop: 14, textTransform: "uppercase", letterSpacing: "0.03em" }}>Club admin</h1>
        <p className="muted small">Manage your club, members and invite codes.</p>
      </div>

      <div className="card">
        <form onSubmit={submit}>
          <label>Admin email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in as admin"}
          </button>
        </form>
      </div>

      <p className="small center" style={{ marginTop: 14 }}>
        <Link href="/forgot-password" className="muted">
          Forgot your password?
        </Link>
      </p>
      <p className="small center muted" style={{ marginTop: 10 }}>
        No club yet? <Link href="/create-club">Create one</Link>
        <br />
        Player? <Link href="/sign-in">Member sign-in</Link>
      </p>
    </div>
  );
}
