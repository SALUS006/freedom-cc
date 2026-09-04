import type { NextRequest } from "next/server";
import { one, tx } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { profileSchema } from "@/lib/validation";
import { handleError, ok } from "@/lib/api";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const member = await one<Member>(
      `select id, club_id, name, email, phone, roles, batting_style, bowling_type,
              bat_self, bowl_self, field_self, is_keeper, happy_to_captain, is_admin,
              has_avatar, consent_version, consent_at, created_at
         from members where id = $1`,
      [session.memberId]
    );
    return ok(member);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = profileSchema.parse(await req.json());

    const member = await tx(async (client) => {
      const res = await client.query(
        `update members set
           phone = $2,
           roles = $3,
           batting_style = $4,
           bowling_type = $5,
           bat_self = $6,
           bowl_self = $7,
           field_self = $8,
           is_keeper = $9,
           happy_to_captain = $10
         where id = $1
         returning *`,
        [
          session.memberId,
          body.phone || null,
          body.roles,
          body.battingStyle ?? null,
          body.bowlingType ?? null,
          body.batSelf,
          body.bowlSelf,
          body.fieldSelf,
          body.isKeeper,
          body.happyToCaptain,
        ]
      );
      await client.query(
        `insert into rating_changes (member_id, bat_self, bowl_self, field_self)
         values ($1,$2,$3,$4)`,
        [session.memberId, body.batSelf, body.bowlSelf, body.fieldSelf]
      );
      return res.rows[0] as Member;
    });

    return ok(member);
  } catch (err) {
    return handleError(err);
  }
}
