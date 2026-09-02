import type { NextRequest } from "next/server";
import { z } from "zod";
import { one, query, tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { eventSchema } from "@/lib/validation";
import { reduceInnings } from "@/lib/scoring/engine";
import type { MatchEvent } from "@/lib/scoring/types";
import { scoringConfig } from "@/lib/match";
import { handleError, fail, ok } from "@/lib/api";
import type { InningsRow, MatchRow } from "@/lib/types";

const postSchema = eventSchema.extend({ inningsSeq: z.union([z.literal(1), z.literal(2)]) });

type LoadResult =
  | { error: ReturnType<typeof fail> }
  | { error?: undefined; match: MatchRow; innings: InningsRow };

async function loadInnings(matchId: string, seq: number): Promise<LoadResult> {
  const match = await one<MatchRow>(`select * from matches where id = $1`, [matchId]);
  if (!match) return { error: fail(404, "Match not found") };
  const innings = await one<InningsRow>(
    `select * from innings where match_id = $1 and seq = $2`,
    [matchId, seq]
  );
  if (!innings) return { error: fail(404, "Innings not started") };
  return { match, innings };
}

async function stateFor(match: MatchRow, innings: InningsRow) {
  const rows = await query<{ type: string; payload: Record<string, unknown> }>(
    `select type, payload from match_events where innings_id = $1 order by seq`,
    [innings.id]
  );
  const events = rows.map((r) => ({ type: r.type, ...(r.payload as object) })) as MatchEvent[];
  return reduceInnings(events, scoringConfig(match), innings.target);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = postSchema.parse(await req.json());
    const loaded = await loadInnings(id, body.inningsSeq);
    if ("error" in loaded) return loaded.error;
    const { match, innings } = loaded;
    if (match.status === "complete") return fail(409, "Match is complete");

    const { type, ...rest } = body.event;
    const payload = rest as Record<string, unknown>;

    await tx(async (client) => {
      const dupe = await client.query(`select 1 from match_events where client_uuid = $1`, [
        body.clientUuid,
      ]);
      if (dupe.rowCount) return; // idempotent replay
      const seqRow = await client.query(
        `select coalesce(max(seq),0) + 1 as n from match_events where innings_id = $1`,
        [innings.id]
      );
      await client.query(
        `insert into match_events (innings_id, seq, type, payload, client_uuid)
         values ($1,$2,$3,$4,$5)`,
        [innings.id, seqRow.rows[0].n, type, JSON.stringify(payload), body.clientUuid]
      );
    });

    return ok({ state: await stateFor(match, innings) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const seq = Number(new URL(req.url).searchParams.get("inningsSeq") ?? "1");
    const loaded = await loadInnings(id, seq);
    if ("error" in loaded) return loaded.error;
    const { match, innings } = loaded;
    if (match.status === "complete") return fail(409, "Match is complete");

    await query(
      `delete from match_events where id = (
         select id from match_events where innings_id = $1 order by seq desc limit 1
       )`,
      [innings.id]
    );

    return ok({ state: await stateFor(match, innings) });
  } catch (err) {
    return handleError(err);
  }
}
