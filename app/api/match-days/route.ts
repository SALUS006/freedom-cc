import type { NextRequest } from "next/server";
import { tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { matchDaySchema } from "@/lib/validation";
import { findMatchDayByDate, matchDayPlayers, setMatchDayTurnout } from "@/lib/data";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = matchDaySchema.parse(await req.json());

    // One match day per club per date: reuse it and just merge the turnout in,
    // rather than creating a second one for the same day.
    const existing = await findMatchDayByDate(session.clubId, body.playedOn);
    if (existing) {
      const current = await matchDayPlayers(existing.id);
      const merged = new Set([...current.map((m) => m.id), ...body.playerIds]);
      await setMatchDayTurnout(existing.id, session.clubId, [...merged]);
      return ok({ id: existing.id, joinedExisting: true });
    }

    const day = await tx(async (client) => {
      const res = await client.query(
        `insert into match_days (club_id, played_on, ground, notes, created_by)
         values ($1,$2,$3,$4,$5) returning *`,
        [session.clubId, body.playedOn, body.ground || null, body.notes || null, session.memberId]
      );
      const created = res.rows[0];
      for (const id of body.playerIds) {
        await client.query(
          `insert into match_day_players (match_day_id, member_id)
           select $1, $2 where exists (select 1 from members where id = $2 and club_id = $3)
           on conflict do nothing`,
          [created.id, id, session.clubId]
        );
      }
      return created;
    });

    return ok({ id: day.id, joinedExisting: false });
  } catch (err) {
    return handleError(err);
  }
}
