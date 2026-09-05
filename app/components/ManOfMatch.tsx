"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ManOfMatch({
  matchId,
  playerOfMatchId,
  auto,
  names,
  statLines,
  isAdmin,
}: {
  matchId: string;
  playerOfMatchId: string | null;
  auto: boolean;
  names: Record<string, string>;
  statLines: Record<string, string>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(memberId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/player-of-match`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not update");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  if (!playerOfMatchId && !isAdmin) return null;

  return (
    <div className="card" data-testid="man-of-match" style={{ marginTop: 12 }}>
      {playerOfMatchId && !editing ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div className="small muted">🏅 Player of the Match{auto ? "" : " (admin pick)"}</div>
            <div className="lead">{names[playerOfMatchId] ?? "?"}</div>
            <div className="small muted">{statLines[playerOfMatchId] ?? ""}</div>
          </div>
          {isAdmin && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="small muted" style={{ marginBottom: 8 }}>
            Pick Player of the Match
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(names).map(([id, name]) => (
              <button
                key={id}
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => pick(id)}
                data-testid={`motm-pick-${id}`}
              >
                {name} {statLines[id] ? `— ${statLines[id]}` : ""}
              </button>
            ))}
          </div>
          {playerOfMatchId && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          )}
          {error && <span className="error small">{error}</span>}
        </div>
      )}
    </div>
  );
}
