import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { requireSession, setSessionCookie } from "@/lib/session";
import { accountSchema } from "@/lib/validation";
import { handleError, fail, ok } from "@/lib/api";

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = accountSchema.parse(await req.json());

    const clash = await one(
      `select 1 from members where club_id = $1 and lower(email) = lower($2) and id <> $3`,
      [session.clubId, body.email, session.memberId]
    );
    if (clash) return fail(409, "Another member already uses that email");

    await query(`update members set name = $2, email = $3 where id = $1`, [
      session.memberId,
      body.name,
      body.email,
    ]);

    // keep the session's display name fresh
    await setSessionCookie({ ...session, name: body.name });
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
