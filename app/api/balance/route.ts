import type { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { balanceReport, maxOversPerBowler, type BalancePlayer } from "@/lib/balance";
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

    const members = await query<Member & { matches: number }>(
      `select m.*, coalesce((select count(distinct match_id) from match_squads s where s.member_id = m.id),0)::int as matches
         from members m where m.club_id = $1 and m.id = any($2::uuid[])`,
      [session.clubId, ids]
    );
    const byId = new Map(members.map((m) => [m.id, m]));
    const toPlayers = (list: string[]): BalancePlayer[] =>
      list
        .map((id) => byId.get(id))
        .filter((m): m is Member & { matches: number } => !!m)
        .map((m) => ({
          id: m.id,
          name: m.name,
          bat: m.bat_self,
          bowl: m.bowl_self,
          field: m.field_self,
          isKeeper: m.is_keeper || m.roles.includes("keeper"),
          matches: m.matches,
        }));

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
