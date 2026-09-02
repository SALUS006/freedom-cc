"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Consent } from "@/app/components/Consent";

export default function CreateClub() {
  const router = useRouter();
  const [form, setForm] = useState({
    clubName: "",
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
      const res = await fetch("/api/club", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create club");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="screen-head">
        <button className="back" onClick={() => router.back()} aria-label="Back">
          ‹
        </button>
        <h1>Create your club</h1>
      </div>
      <p className="muted small">You&rsquo;ll be the club admin. Others join with an invite code.</p>
      <form onSubmit={submit}>
        <label>Club name</label>
        <input type="text" value={form.clubName} onChange={set("clubName")} required placeholder="Freedom Cricket Club" />
        <label>Your name</label>
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
          {busy ? "Creating…" : "Create club"}
        </button>
      </form>
    </div>
  );
}
