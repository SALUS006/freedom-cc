"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Consent } from "@/app/components/Consent";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({
    inviteCode: params.get("code") ?? "",
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not register");
      router.push("/profile?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="screen-head">
        <button className="back" onClick={() => router.push("/welcome")} aria-label="Back">
          ‹
        </button>
        <h1>Register</h1>
      </div>
      <form onSubmit={submit}>
        <label>Invite code</label>
        <input type="text" value={form.inviteCode} onChange={set("inviteCode")} required style={{ textTransform: "uppercase" }} />
        <label>Full name</label>
        <input type="text" value={form.name} onChange={set("name")} required />
        <label>Email</label>
        <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
        <label>Phone (optional)</label>
        <input type="tel" value={form.phone} onChange={set("phone")} />
        <label>Password</label>
        <input type="password" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
        <Consent checked={consent} onChange={setConsent} />
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy || !consent}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
