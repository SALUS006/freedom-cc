import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMatchDay, matchDayPlayers } from "@/lib/data";
import { loadDayCards } from "@/lib/match";

export const dynamic = "force-dynamic";

function crest(name: string) {
  return name.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export default async function MatchDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const day = await getMatchDay(id, session.clubId);
  if (!day) notFound();

  const [players, cards] = await Promise.all([matchDayPlayers(id), loadDayCards(id)]);

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href="/play" aria-label="Back">
          ‹
        </Link>
        <h1>
          {new Date(day.played_on).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h1>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>
        {day.ground ? `${day.ground} · ` : ""}
        {players.length} players
      </p>

      <Link className="btn btn-primary" href={`/play/day/${id}/new-match`}>
        New match
      </Link>

      <div className="section-title">Matches</div>
      {cards.length === 0 ? (
        <div className="card center muted small">No matches yet.</div>
      ) : (
        <div className="stack">
          {cards.map((c) => (
            <Link key={c.match.id} href={`/play/match/${c.match.id}`} className="match-card">
              <div className="match-card__head">
                <span>
                  Match {c.match.seq_no} · {c.match.overs} overs
                </span>
                {c.status === "live" && (
                  <span className="badge badge--live">
                    <span className="dot" /> Live
                  </span>
                )}
                {c.status === "complete" && <span className="badge badge--done">Result</span>}
                {c.status === "setup" && <span className="badge badge--soon">Not started</span>}
              </div>
              <div className="match-card__body">
                {c.lines.map((l) => (
                  <div key={l.side} className={`team-row ${l.batted ? "" : "dim"}`}>
                    <span className="tname">
                      <span className="crest">{crest(l.name)}</span>
                      {l.name}
                    </span>
                    <span className="tscore">
                      {l.batted ? `${l.runs}/${l.wickets} (${l.overs})` : "—"}
                    </span>
                  </div>
                ))}
              </div>
              {c.summary && <div className="match-card__foot">{c.summary}</div>}
            </Link>
          ))}
        </div>
      )}

      <div className="section-title">Turnout</div>
      <div className="card flush">
        {players.map((p) => (
          <div key={p.id} className="list-tap">
            <span className="lead">{p.name}</span>
            <span className="sub">{p.roles.join(" · ") || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
