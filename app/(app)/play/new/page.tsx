"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Member } from "@/lib/types";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewMatchDay() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [playedOn, setPlayedOn] = useState(today());
  const [ground, setGround] = useState("");
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setError("Could not load players"));
  }, []);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (picked.size < 4) {
      setError("Pick at least 4 players who turned up");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/match-days", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          playedOn,
          ground,
          notes,
          playerIds: [...picked],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create match day");
      router.push(data.joinedExisting ? `/play/day/${data.id}?joined=1` : `/play/day/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href="/play" aria-label="Back">
          ‹
        </Link>
        <h1>New match day</h1>
      </div>

      <form onSubmit={submit}>
        <label>Date</label>
        <input type="date" value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} required />
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          There's only one match day per date — if one already exists for this date, your picks
          here join its turnout instead of starting a new one.
        </p>
        <label>Ground (optional)</label>
        <input type="text" value={ground} onChange={(e) => setGround(e.target.value)} />
        <label>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />

        <h2>Who turned up? ({picked.size})</h2>
        <div className="card" style={{ padding: "4px 12px" }}>
          {members.map((m) => (
            <label key={m.id} className="list-tap" style={{ cursor: "pointer" }}>
              <span>{m.name}</span>
              <input
                type="checkbox"
                checked={picked.has(m.id)}
                onChange={() => toggle(m.id)}
                style={{ width: 22, height: 22 }}
              />
            </label>
          ))}
          {members.length === 0 && <p className="muted small">No players registered yet.</p>}
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy}>
          {busy ? "Creating…" : "Create match day"}
        </button>
      </form>
    </div>
  );
}
