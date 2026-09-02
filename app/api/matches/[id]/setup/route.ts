import type { NextRequest } from "next/server";
import { one, tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { setupSchema } from "@/lib/validation";
import { battingSideFor } from "@/lib/match";
import { handleError, fail, ok } from "@/lib/api";
import type { MatchRow } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = setupSchema.parse(await req.json());

    const match = await one<MatchRow>(`select * from matches where id = $1`, [id]);
    if (!match) return fail(404, "Match not found");
    if (match.status === "complete") return fail(409, "Match already complete");

    const withToss = { ...match, toss_winner: body.tossWinner, elected: body.elected };
    const firstBatting = battingSideFor(withToss, 1);

    await tx(async (client) => {
      await client.query(
        `update matches set toss_winner = $2, elected = $3, status = 'live' where id = $1`,
        [id, body.tossWinner, body.elected]
      );
      await client.query(
        `insert into innings (match_id, seq, batting_side) values ($1, 1, $2)
         on conflict (match_id, seq) do nothing`,
        [id, firstBatting]
      );
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
