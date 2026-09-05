import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMatchDay, matchDayPlayers, memberCount } from "@/lib/data";
import { loadDayCards } from "@/lib/match";

export const dynamic = "force-dynamic";

function crest(name: string) {
  return name.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export default async function MatchDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { id } = await params;
  const { joined } = await searchParams;
  const session = await getSession();
  if (!session) return null;
  const day = await getMatchDay(id, session.clubId);
  if (!day) notFound();

  const [players, cards, totalMembers] = await Promise.all([
    matchDayPlayers(id),
    loadDayCards(id),
    memberCount(session.clubId),
  ]);

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

      {joined === "1" && (
        <p className="notice" data-testid="joined-existing-day">
          There's already a match day for this date — your picks were added to its turnout instead
          of starting a new one.
        </p>
      )}

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

      <div className="row" style={{ margin: "24px 0 10px" }}>
        <span className="section-title" style={{ margin: 0 }}>
          Turnout
        </span>
        <Link
          href={`/play/day/${id}/turnout`}
          className="pill brand"
          data-testid="edit-turnout-link"
          style={{ textTransform: "none", letterSpacing: "normal" }}
        >
          {players.length < totalMembers
            ? `Add players (${totalMembers - players.length} missing)`
            : "Edit"}
        </Link>
      </div>
      {players.length < totalMembers && (
        <p className="notice warn small" style={{ marginTop: 0 }}>
          Only {players.length} of {totalMembers} registered players are in today's turnout —
          anyone who registered after this match day was created won't show up until you add them.
        </p>
      )}
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
