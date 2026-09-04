import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { accountSchema } from "@/lib/validation";
import { handleError, fail, ok } from "@/lib/api";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session.isAdmin) throw new HttpError(403, "Admins only");
    const { id } = await params;
    const body = accountSchema.parse(await req.json());

    const member = await one(`select 1 from members where id = $1 and club_id = $2`, [
      id,
      session.clubId,
    ]);
    if (!member) return fail(404, "Player not found");

    const clash = await one(
      `select 1 from members where club_id = $1 and lower(email) = lower($2) and id <> $3`,
      [session.clubId, body.email, id]
    );
    if (clash) return fail(409, "Another member already uses that email");

    await query(`update members set name = $2, email = $3 where id = $1`, [id, body.name, body.email]);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
