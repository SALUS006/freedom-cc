import type { NextRequest } from "next/server";
import { z } from "zod";
import { one } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { setPlayerOfMatch } from "@/lib/data";
import { handleError, fail, ok } from "@/lib/api";

const schema = z.object({ memberId: z.string().uuid() });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session.isAdmin) throw new HttpError(403, "Admins only");
    const { id } = await params;
    const body = schema.parse(await req.json());

    const inSquad = await one(
      `select 1 from match_squads where match_id = $1 and member_id = $2`,
      [id, body.memberId]
    );
    if (!inSquad) return fail(400, "That player wasn't in this match");

    await setPlayerOfMatch(id, body.memberId, false);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
