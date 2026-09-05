import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
import { matchStatsFor } from "@/lib/data";
import { statLine } from "@/lib/scoring/points";
import { Scorecard } from "@/app/components/Scorecard";
import { ManOfMatch } from "@/app/components/ManOfMatch";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const bundle = await loadMatchBundle(id);
  if (!bundle) notFound();
  const { match } = bundle;

  if (match.status === "setup") redirect(`/play/match/${id}/setup`);

  const statLines: Record<string, string> = {};
  if (match.status === "complete") {
    const stats = await matchStatsFor(id);
    for (const s of stats) {
      statLines[s.member_id] = statLine({
        ...s,
        memberId: s.member_id,
        isCaptain: false,
        howOut: s.how_out,
        legalBalls: s.legal_balls,
        runsConceded: s.runs_conceded,
        runOuts: s.run_outs,
        batPoints: s.bat_points,
        bowlPoints: s.bowl_points,
        fieldPoints: s.field_points,
        resultPoints: s.result_points,
        totalPoints: s.total_points,
      });
    }
  }

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href={`/play/day/${match.match_day_id}`} aria-label="Back">
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
      <p className="small muted" style={{ marginTop: -6 }}>
        Match {match.seq_no} · {match.overs} overs a side
      </p>

      {bundle.result && <p className="notice win">{bundle.result.summary}</p>}

      {match.status === "complete" && (
        <ManOfMatch
          matchId={id}
          playerOfMatchId={match.player_of_match_id}
          auto={match.player_of_match_auto}
          names={bundle.names}
          statLines={statLines}
          isAdmin={session.isAdmin}
        />
      )}

      {match.status === "live" && (
        <div className="grid2" style={{ margin: "12px 0" }}>
          <Link className="btn btn-primary" href={`/play/match/${id}/score`}>
            Continue scoring
          </Link>
          <Link className="btn btn-ghost" href={`/play/match/${id}/live`}>
            Live scorecard
          </Link>
        </div>
      )}

      <Scorecard bundle={bundle} />
    </div>
  );
}
