import type { NextRequest } from "next/server";
import { one, tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { createMatchSchema } from "@/lib/validation";
import { maxOversPerBowler } from "@/lib/balance";
import { DEFAULT_RULES } from "@/lib/types";
import { handleError, fail, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createMatchSchema.parse(await req.json());

    const day = await one<{ id: string }>(
      `select id from match_days where id = $1 and club_id = $2`,
      [body.matchDayId, session.clubId]
    );
    if (!day) return fail(404, "Match day not found");

    const sideA = body.squad.filter((s) => s.side === "a");
    const sideB = body.squad.filter((s) => s.side === "b");
    if (sideA.length < 2 || sideB.length < 2) return fail(400, "Each side needs at least 2 players");
    if (!sideA.some((s) => s.isCaptain) || !sideB.some((s) => s.isCaptain))
      return fail(400, "Pick a captain for each side");

    const match = await tx(async (client) => {
      const seq = await client.query(
        `select coalesce(max(seq_no),0) + 1 as n from matches where match_day_id = $1`,
        [body.matchDayId]
      );
      const res = await client.query(
        `insert into matches
           (match_day_id, seq_no, overs, players_per_side, max_overs_per_bowler, rules,
            side_a_name, side_b_name)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [
          body.matchDayId,
          seq.rows[0].n,
          body.overs,
          body.playersPerSide,
          maxOversPerBowler(body.overs),
          JSON.stringify({ ...DEFAULT_RULES, ...body.rules }),
          body.sideAName,
          body.sideBName,
        ]
      );
      const created = res.rows[0];
      for (const s of body.squad) {
        await client.query(
          `insert into match_squads
             (match_id, member_id, side, batting_order, is_captain, is_keeper)
           values ($1,$2,$3,$4,$5,$6)`,
          [created.id, s.memberId, s.side, s.battingOrder, s.isCaptain, s.isKeeper]
        );
      }
      return created;
    });

    return ok({ id: match.id });
  } catch (err) {
    return handleError(err);
  }
}
