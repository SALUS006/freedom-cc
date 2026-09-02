import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
import { Scorecard } from "@/app/components/Scorecard";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const bundle = await loadMatchBundle(id);
  if (!bundle) notFound();
  const { match } = bundle;

  if (match.status === "setup") redirect(`/play/match/${id}/setup`);

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
