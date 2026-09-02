import { tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
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

    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
