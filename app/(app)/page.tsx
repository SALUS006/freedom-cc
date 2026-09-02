import Link from "next/link";
import { currentClub, currentMember, listMatchDays, listMembers } from "@/lib/data";
import { loadLiveCards } from "@/lib/match";

export const dynamic = "force-dynamic";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function crest(name: string) {
  return name.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export default async function Home() {
  const [club, me] = await Promise.all([currentClub(), currentMember()]);
  if (!club || !me) return null;
  const [days, members, live] = await Promise.all([
    listMatchDays(club.id),
    listMembers(club.id),
    loadLiveCards(club.id),
  ]);
  const recent = days.slice(0, 5);
  const totalMatches = days.reduce((s, d) => s + d.matches, 0);

  return (
    <div>
      <div className="screen-head">
        <h1>{club.name}</h1>
      </div>
      <p className="muted" style={{ marginTop: -6 }}>
        Welcome back, {me.name.split(" ")[0]}.
      </p>

      {live.length > 0 && (
        <>
          <div className="section-title">
            <span className="badge badge--live">
              <span className="dot" /> Live now
            </span>
          </div>
          <div className="stack">
            {live.map((c) => (
              <Link key={c.match.id} href={`/play/match/${c.match.id}/score`} className="match-card">
                <div className="match-card__head">
                  <span>
                    {c.match.side_a_name} v {c.match.side_b_name} · {c.match.overs} ov
                  </span>
                  <span className="pill brand">Tap to score</span>
                </div>
                <div className="match-card__body">
                  {c.lines.map((l) => (
                    <div key={l.side} className={`team-row ${l.batted ? "" : "dim"}`}>
                      <span className="tname">
                        <span className="crest">{crest(l.name)}</span>
                        {l.name}
                      </span>
                      <span className="tscore">
                        {l.batted ? `${l.runs}/${l.wickets} (${l.overs})` : "yet to bat"}
                      </span>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="grid3" style={{ marginTop: 16 }}>
        <div className="stat-tile">
          <div className="n">{members.length}</div>
          <div className="l">Players</div>
        </div>
        <div className="stat-tile">
          <div className="n">{days.length}</div>
          <div className="l">Match days</div>
        </div>
        <div className="stat-tile">
          <div className="n">{totalMatches}</div>
          <div className="l">Matches</div>
        </div>
      </div>

      <Link className="btn btn-primary" href="/play/new" style={{ marginTop: 16 }}>
        Start a match day
      </Link>

      {me.is_admin && (
        <Link className="btn btn-ghost btn-block" href="/admin" style={{ marginTop: 10 }}>
          Admin &amp; invites
        </Link>
      )}

      <div className="card tight" style={{ marginTop: 12 }}>
        <div className="row">
          <span className="small muted">Club invite code</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.15rem",
              letterSpacing: "0.12em",
              color: "var(--brand)",
            }}
          >
            {club.invite_code}
          </span>
        </div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          Share this so teammates can register.
        </p>
      </div>

      <div className="section-title">Recent match days</div>
      {recent.length === 0 ? (
        <div className="card center muted small">No match days yet — start one above.</div>
      ) : (
        <div className="card flush">
          {recent.map((d) => (
            <Link key={d.id} href={`/play/day/${d.id}`} className="list-tap">
              <span>
                <span className="lead">{fmtDate(d.played_on)}</span>
                {d.ground && <div className="sub">{d.ground}</div>}
              </span>
              <span className="pill">
                {d.matches} match{d.matches === 1 ? "" : "es"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
