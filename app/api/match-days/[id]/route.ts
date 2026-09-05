import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/session";
import {
  getMatchDay,
  matchDayLockedPlayerIds,
  matchDayPlayers,
  setMatchDayTurnout,
} from "@/lib/data";
import { updateTurnoutSchema } from "@/lib/validation";
import { handleError, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const day = await getMatchDay(id, session.clubId);
    if (!day) return fail(404, "Match day not found");
    const [players, lockedPlayerIds] = await Promise.all([
      matchDayPlayers(id),
      matchDayLockedPlayerIds(id),
    ]);
    return ok({ day, players, lockedPlayerIds });
  } catch (err) {
    return handleError(err);
  }
}

/** Add newly-registered players (or anyone missed) to this day's turnout. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const day = await getMatchDay(id, session.clubId);
    if (!day) return fail(404, "Match day not found");

    const body = updateTurnoutSchema.parse(await req.json());
    await setMatchDayTurnout(id, session.clubId, body.playerIds);

    const players = await matchDayPlayers(id);
    return ok({ players });
  } catch (err) {
    return handleError(err);
  }
}
