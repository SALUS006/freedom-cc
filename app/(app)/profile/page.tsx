"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Member, Role } from "@/lib/types";

const ROLES: { key: Role; label: string }[] = [
  { key: "batter", label: "Batter" },
  { key: "bowler", label: "Bowler" },
  { key: "keeper", label: "Wicket-keeper" },
  { key: "allrounder", label: "All-rounder" },
];

function ProfileForm() {
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";

  const [m, setM] = useState<Member | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setM)
      .catch(() => setError("Could not load your profile"));
  }, []);

  if (error && !m) return <p className="error">{error}</p>;
  if (!m) return <p className="muted">Loading…</p>;

  const toggleRole = (r: Role) => {
    const roles = m.roles.includes(r) ? m.roles.filter((x) => x !== r) : [...m.roles, r];
    setM({ ...m, roles });
  };

  async function save() {
    if (!m) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: m.phone ?? "",
          roles: m.roles,
          battingStyle: m.batting_style,
          bowlingType: m.bowling_type,
          batSelf: m.bat_self,
          bowlSelf: m.bowl_self,
          fieldSelf: m.field_self,
          isKeeper: m.is_keeper || m.roles.includes("keeper"),
          happyToCaptain: m.happy_to_captain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      if (welcome) {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/welcome");
    router.refresh();
  }

  const Slider = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
  }) => (
    <>
      <label>{label}</label>
      <div className="slider-row">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="val">{value}</span>
      </div>
    </>
  );

  return (
    <div>
      <div className="screen-head">
        <h1>{welcome ? "Set up your profile" : "Profile"}</h1>
      </div>
      {welcome && (
        <p className="notice">
          Welcome to the club. Pick your roles and rate yourself — captains use this to pick fair
          sides.
        </p>
      )}

      <h2>Roles</h2>
      <div className="chip-select">
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={m.roles.includes(r.key) ? "on" : ""}
            onClick={() => toggleRole(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <h2>Self-rating</h2>
      <div className="card">
        <Slider label="Batting" value={m.bat_self} onChange={(v) => setM({ ...m, bat_self: v })} />
        <Slider label="Bowling" value={m.bowl_self} onChange={(v) => setM({ ...m, bowl_self: v })} />
        <Slider label="Fielding" value={m.field_self} onChange={(v) => setM({ ...m, field_self: v })} />
      </div>

      <h2>Details</h2>
      <label>Batting hand</label>
      <select
        value={m.batting_style ?? ""}
        onChange={(e) => setM({ ...m, batting_style: e.target.value || null })}
      >
        <option value="">—</option>
        <option value="right">Right-hand</option>
        <option value="left">Left-hand</option>
      </select>
      <label>Bowling type</label>
      <select
        value={m.bowling_type ?? ""}
        onChange={(e) => setM({ ...m, bowling_type: e.target.value || null })}
      >
        <option value="">—</option>
        <option value="pace">Pace</option>
        <option value="off-spin">Off-spin</option>
        <option value="leg-spin">Leg-spin</option>
        <option value="left-arm">Left-arm</option>
      </select>
      <label>Phone</label>
      <input
        type="tel"
        value={m.phone ?? ""}
        onChange={(e) => setM({ ...m, phone: e.target.value })}
      />
      <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
        <input
          type="checkbox"
          checked={m.happy_to_captain}
          onChange={(e) => setM({ ...m, happy_to_captain: e.target.checked })}
          style={{ width: 20, height: 20 }}
        />
        <span style={{ color: "var(--ink)" }}>Happy to captain</span>
      </label>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={busy}>
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      {m.is_admin && (
        <a className="btn btn-ghost btn-block" href="/admin" style={{ marginTop: 10 }}>
          Admin &amp; invites
        </a>
      )}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <ProfileForm />
    </Suspense>
  );
}
