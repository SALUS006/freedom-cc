import Link from "next/link";
import { currentClub, listMatchDays } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PlayIndex() {
  const club = await currentClub();
  if (!club) return null;
  const days = await listMatchDays(club.id);

  return (
    <div>
      <div className="screen-head">
        <h1>Play</h1>
      </div>

      <Link className="btn btn-primary" href="/play/new">
        Start a match day
      </Link>

      <div className="section-title">Match days</div>
      {days.length === 0 ? (
        <div className="card center muted small">Nothing yet. Start a match day above.</div>
      ) : (
        <div className="stack">
          {days.map((d) => (
            <Link key={d.id} href={`/play/day/${d.id}`} className="match-card">
              <div className="match-card__head">
                <span>
                  {new Date(d.played_on).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="pill">
                  {d.matches} match{d.matches === 1 ? "" : "es"}
                </span>
              </div>
              {d.ground && (
                <div className="match-card__body">
                  <span className="small muted">{d.ground}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
