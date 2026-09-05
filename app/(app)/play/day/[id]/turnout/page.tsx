"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Member } from "@/lib/types";

export default function EditTurnout() {
  const router = useRouter();
  const { id: dayId } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<Member[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/players").then((r) => r.json()),
      fetch(`/api/match-days/${dayId}`).then((r) => r.json()),
    ])
      .then(([allPlayers, dayData]) => {
        setRoster(Array.isArray(allPlayers) ? allPlayers : []);
        setPicked(new Set((dayData.players ?? []).map((p: Member) => p.id)));
        setLocked(new Set(dayData.lockedPlayerIds ?? []));
      })
      .catch(() => setError("Could not load players"))
      .finally(() => setLoading(false));
  }, [dayId]);

  const toggle = (id: string) => {
    if (locked.has(id)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setPicked(new Set(roster.map((p) => p.id)));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/match-days/${dayId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerIds: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save turnout");
      router.push(`/play/day/${dayId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/day/${dayId}`} aria-label="Back">
          ‹
        </Link>
        <h1>Edit turnout</h1>
      </div>
      <p className="muted small" style={{ marginTop: -6 }} data-testid="turnout-count">
        {picked.size} of {roster.length} registered players selected
      </p>

      <button
        type="button"
        className="btn btn-ghost btn-block"
        data-testid="turnout-select-all"
        onClick={selectAll}
      >
        Select everyone registered
      </button>

      <div className="card flush" style={{ marginTop: 12 }}>
        {roster.map((p) => (
          <label
            key={p.id}
            className="list-tap"
            style={{ cursor: locked.has(p.id) ? "default" : "pointer" }}
          >
            <span>
              {p.name}
              {locked.has(p.id) && <span className="sub"> · already in a match today</span>}
            </span>
            <input
              type="checkbox"
              data-testid={`turnout-${p.name}`}
              checked={picked.has(p.id)}
              disabled={locked.has(p.id)}
              onChange={() => toggle(p.id)}
              style={{ width: 22, height: 22 }}
            />
          </label>
        ))}
        {roster.length === 0 && <p className="small muted" style={{ padding: 12 }}>No players registered.</p>}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save turnout"}
      </button>
    </div>
  );
}
