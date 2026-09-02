import { requireSession } from "@/lib/session";
import { getMatchDay, matchDayPlayers } from "@/lib/data";
import { handleError, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const day = await getMatchDay(id, session.clubId);
    if (!day) return fail(404, "Match day not found");
    const players = await matchDayPlayers(id);
    return ok({ day, players });
  } catch (err) {
    return handleError(err);
  }
}
