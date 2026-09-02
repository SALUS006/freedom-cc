import type { MatchBundle, InningsView } from "@/lib/match";
import {
  dismissalText,
  economy,
  oversFromBalls,
  runRate,
  shortName,
  strikeRate,
} from "@/lib/scoring/format";

function InningsBlock({
  inn,
  names,
  totalOvers,
}: {
  inn: InningsView;
  names: Record<string, string>;
  totalOvers: number;
}) {
  const s = inn.state;
  const ballsLeft = totalOvers * 6 - s.legalBalls;

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "baseline" }}>
        <strong style={{ fontSize: "1rem" }}>{inn.battingName}</strong>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.4rem",
            color: "var(--brand)",
          }}
        >
          {s.runs}/{s.wickets}
          <span className="small muted" style={{ fontFamily: "var(--font-sans)", fontWeight: 400, marginLeft: 6 }}>
            ({s.oversLabel} ov)
          </span>
        </span>
      </div>
      <p className="small muted" style={{ margin: "2px 0 0" }}>
        RR {runRate(s.runs, s.legalBalls)}
        {s.target != null && !s.closed && ` · need ${Math.max(0, s.target - s.runs)} off ${Math.max(0, ballsLeft)}`}
        {s.closed && ` · ${s.closed.replace("_", " ")}`}
      </p>

      <table className="card-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Batter</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {s.batters.map((b) => (
            <tr key={b.id}>
              <td>
                <span style={{ fontWeight: 600 }}>{shortName(names[b.id] ?? "?")}</span>
                {b.onCrease && !s.closed ? " *" : ""}
                <div className="how">{dismissalText(b, names)}</div>
              </td>
              <td className="r">{b.runs}</td>
              <td>{b.balls}</td>
              <td>{b.fours}</td>
              <td>{b.sixes}</td>
              <td>{strikeRate(b.runs, b.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="small muted" style={{ margin: "10px 0 0" }}>
        Extras <strong>{s.extras.total}</strong> (b {s.extras.b}, lb {s.extras.lb}, w {s.extras.w}, nb{" "}
        {s.extras.nb})
      </p>

      <table className="card-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {s.bowlers.map((b) => (
            <tr key={b.id}>
              <td style={{ fontWeight: 600 }}>{shortName(names[b.id] ?? "?")}</td>
              <td>{oversFromBalls(b.balls)}</td>
              <td>{b.maidens}</td>
              <td>{b.runs}</td>
              <td className="r">{b.wickets}</td>
              <td>{economy(b.runs, b.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.fallOfWickets.length > 0 && (
        <p className="small muted" style={{ margin: "10px 0 0", lineHeight: 1.7 }}>
          <strong>FoW:</strong>{" "}
          {s.fallOfWickets
            .map((f) => `${f.runs}-${f.wicket} (${shortName(names[f.batterId] ?? "?")}, ${f.over})`)
            .join("   ")}
        </p>
      )}
    </div>
  );
}

export function Scorecard({ bundle }: { bundle: MatchBundle }) {
  if (bundle.innings.length === 0) {
    return <div className="card center muted small">No scoring yet.</div>;
  }
  return (
    <div className="stack">
      {bundle.innings.map((inn) => (
        <InningsBlock
          key={inn.row.id}
          inn={inn}
          names={bundle.names}
          totalOvers={bundle.match.overs}
        />
      ))}
    </div>
  );
}
