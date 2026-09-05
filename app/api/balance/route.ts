import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { balanceReport, maxOversPerBowler, type BalancePlayer } from "@/lib/balance";
import { computeClubPlayerRatings } from "@/lib/player-ratings";
import { handleError, ok } from "@/lib/api";
import type { Member } from "@/lib/types";

const schema = z.object({
  overs: z.number().int().min(1).max(50),
  aName: z.string().default("Side A"),
  bName: z.string().default("Side B"),
  a: z.array(z.string().uuid()),
  b: z.array(z.string().uuid()),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = schema.parse(await req.json());
    const ids = [...body.a, ...body.b];
    if (ids.length === 0) return ok(null);

    const members = await query<Member>(
      `select * from members where club_id = $1 and id = any($2::uuid[])`,
      [session.clubId, ids]
    );
    const ratings = await computeClubPlayerRatings(session.clubId, members);
    const byId = new Map(members.map((m) => [m.id, m]));

    const toPlayers = (list: string[]): BalancePlayer[] =>
      list
        .map((id) => byId.get(id))
        .filter((m): m is Member => !!m)
        .map((m) => {
          const r = ratings.get(m.id);
          return {
            id: m.id,
            name: m.name,
            // blended self + earned-from-performance rating, once there's enough match history
            bat: r?.bat ?? m.bat_self,
            bowl: r?.bowl ?? m.bowl_self,
            field: r?.field ?? m.field_self,
            isKeeper: m.is_keeper || m.roles.includes("keeper"),
            matches: r?.matches ?? 0,
          };
        });

    const report = balanceReport(
      toPlayers(body.a),
      toPlayers(body.b),
      body.overs,
      maxOversPerBowler(body.overs),
      body.aName,
      body.bName
    );
    return ok(report);
  } catch (err) {
    return handleError(err);
  }
}
