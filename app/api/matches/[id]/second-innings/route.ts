import { one, tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
import { handleError, fail, ok } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const bundle = await loadMatchBundle(id);
    if (!bundle) return fail(404, "Match not found");
    if (bundle.innings.length !== 1) return fail(409, "Second innings not available");
    const first = bundle.innings[0];
    if (!first.state.closed) return fail(409, "First innings is still in progress");

    const secondBatting = first.battingSide === "a" ? "b" : "a";
    const target = first.state.runs + 1;

    const existing = await one(`select 1 from innings where match_id = $1 and seq = 2`, [id]);
    if (existing) return ok({ ok: true });

    await tx(async (client) => {
      await client.query(
        `update innings set closed_reason = $2 where match_id = $1 and seq = 1`,
        [id, first.state.closed]
      );
      await client.query(
        `insert into innings (match_id, seq, batting_side, target) values ($1, 2, $2, $3)`,
        [id, secondBatting, target]
      );
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
