"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { MatchBundle } from "@/lib/match";
import {
  dismissalText,
  economy,
  oversFromBalls,
  requiredRate,
  runRate,
  shortName,
  strikeRate,
} from "@/lib/scoring/format";

export default function LivePage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<MatchBundle | null>(null);
  const [stale, setStale] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/matches/${id}/live`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (alive) {
          setBundle(data);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    };
    pull();
    timer.current = setInterval(pull, 5000);
    return () => {
      alive = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [id]);

  if (!bundle) return <p className="muted">Loading live score…</p>;
  const { match, names } = bundle;
  const live = bundle.innings[bundle.innings.length - 1];
  const chase = bundle.innings.find((i) => i.state.target != null && !i.state.closed);
  const ballsLeft = chase ? match.overs * 6 - chase.state.legalBalls : 0;

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/match/${id}`} aria-label="Back">
          ‹
        </Link>
        <h1>
          {match.side_a_name} v {match.side_b_name}
        </h1>
        {match.status === "live" && (
          <span className="badge badge--live">
            <span className="dot" /> Live
          </span>
        )}
      </div>

      {stale && <p className="notice warn small">Offline — showing the last update.</p>}

      {live && (
        <div className="scorebar">
          <div className="team">{live.battingName}</div>
          <div className="big">
            {live.state.runs}/{live.state.wickets}
          </div>
          <div className="sub">
            {live.state.oversLabel} / {match.overs} ov · RR{" "}
            {runRate(live.state.runs, live.state.legalBalls)}
          </div>
          {chase && (
            <div className="chase">
              {chase.battingName} need{" "}
              {Math.max(0, (chase.state.target ?? 0) - chase.state.runs)} off {ballsLeft} · RRR{" "}
              {requiredRate(chase.state.target ?? 0, chase.state.runs, ballsLeft)}
            </div>
          )}
        </div>
      )}

      {bundle.result && <p className="notice win">{bundle.result.summary}</p>}

      {bundle.innings.map((inn) => {
        const s = inn.state;
        return (
          <div className="card" key={inn.row.id}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <strong>{inn.battingName}</strong>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.3rem", color: "var(--brand)" }}>
                {s.runs}/{s.wickets}
                <span className="small muted" style={{ fontFamily: "var(--font-sans)", fontWeight: 400, marginLeft: 5 }}>
                  ({s.oversLabel})
                </span>
              </span>
            </div>

            <table className="card-table" style={{ marginTop: 10 }}>
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
            <p className="small muted" style={{ margin: "8px 0 0" }}>
              Extras <strong>{s.extras.total}</strong> · b {s.extras.b} lb {s.extras.lb} w{" "}
              {s.extras.w} nb {s.extras.nb}
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

            {s.timeline.length > 0 && (
              <div className="ballseq" style={{ marginTop: 12 }}>
                {s.timeline.slice(-14).map((t, i) => (
                  <span
                    key={i}
                    className={`ball ${t.wicket ? "w" : t.extra ? "ex" : t.runs >= 4 ? "bd" : ""}`}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
