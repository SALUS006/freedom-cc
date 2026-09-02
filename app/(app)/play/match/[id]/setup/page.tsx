"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { MatchBundle } from "@/lib/match";

export default function SetupPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<MatchBundle | null>(null);
  const [toss, setToss] = useState<"a" | "b" | null>(null);
  const [elected, setElected] = useState<"bat" | "field" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setBundle(d);
        if (d?.match?.status === "live") router.replace(`/play/match/${id}/score`);
      })
      .catch(() => setError("Could not load match"));
  }, [id, router]);

  if (error) return <p className="error">{error}</p>;
  if (!bundle) return <p className="muted">Loading…</p>;
  const { match } = bundle;

  async function start() {
    if (!toss || !elected) {
      setError("Pick the toss winner and their choice");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/matches/${id}/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tossWinner: toss, elected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start");
      router.push(`/play/match/${id}/score`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/match/${id}`} aria-label="Back">
          ‹
        </Link>
        <h1>Toss</h1>
      </div>
      <p className="muted">
        {match.side_a_name} v {match.side_b_name} · {match.overs} overs
      </p>

      <h2>Who won the toss?</h2>
      <div className="chip-select">
        <button className={toss === "a" ? "on" : ""} onClick={() => setToss("a")}>
          {match.side_a_name}
        </button>
        <button className={toss === "b" ? "on" : ""} onClick={() => setToss("b")}>
          {match.side_b_name}
        </button>
      </div>

      <h2>They chose to…</h2>
      <div className="chip-select">
        <button className={elected === "bat" ? "on" : ""} onClick={() => setElected("bat")}>
          Bat
        </button>
        <button className={elected === "field" ? "on" : ""} onClick={() => setElected("field")}>
          Field
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Start match"}
      </button>
    </div>
  );
}
