import { tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
import { savePlayerMatchStats, setPlayerOfMatch } from "@/lib/data";
import { computeMatchStats, pickManOfMatch } from "@/lib/scoring/points";
import { handleError, fail, ok } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const bundle = await loadMatchBundle(id);
    if (!bundle) return fail(404, "Match not found");
    if (bundle.innings.length !== 2 || !bundle.innings[1].state.closed)
      return fail(409, "Both innings must be complete");

    const result = bundle.result ?? { winner: null, tie: false, summary: "Result unavailable" };

    await tx(async (client) => {
      await client.query(
        `update innings set closed_reason = $2 where match_id = $1 and seq = 2`,
        [id, bundle.innings[1].state.closed]
      );
      await client.query(`update matches set status = 'complete', result = $2 where id = $1`, [
        id,
        JSON.stringify(result),
      ]);
    });

    const stats = computeMatchStats({
      squad: bundle.squad.map((s) => ({ memberId: s.member_id, side: s.side, isCaptain: s.is_captain })),
      innings: bundle.innings.map((inn) => ({ battingSide: inn.battingSide, state: inn.state })),
      winner: result.winner,
    });
    await savePlayerMatchStats(id, stats);
    const motm = pickManOfMatch(stats, bundle.names);
    await setPlayerOfMatch(id, motm, true);

    return ok({ ...result, playerOfMatchId: motm });
  } catch (err) {
    return handleError(err);
  }
}
