import type { NextRequest } from "next/server";
import { z } from "zod";
import { tx } from "@/lib/db";
import { createClubSchema } from "@/lib/validation";
import { hashPassword, randomCode, slugify } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { CONSENT_VERSION, consentReceiptBody } from "@/lib/consent";
import { sendEmail } from "@/lib/email";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = createClubSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const passwordHash = await hashPassword(body.password);

    const result = await tx(async (client) => {
      const existing = await client.query(`select 1 from clubs limit 1`);
      if (existing.rowCount) {
        throw new z.ZodError([
          { code: "custom", path: ["clubName"], message: "A club already exists on this deployment" },
        ]);
      }
      let slug = slugify(body.clubName);
      const clubRes = await client.query(
        `insert into clubs (name, slug, invite_code) values ($1, $2, $3) returning *`,
        [body.clubName, slug, randomCode(6)]
      );
      const club = clubRes.rows[0];
      const memberRes = await client.query(
        `insert into members (club_id, name, email, phone, password_hash, is_admin, roles,
           consent_version, consent_at, consent_ip)
         values ($1,$2,$3,$4,$5,true,'{}', $6, now(), $7)
         returning id, name, email, is_admin, consent_at`,
        [club.id, body.name, body.email, body.phone || null, passwordHash, CONSENT_VERSION, ip]
      );
      return { club, member: memberRes.rows[0] };
    });

    await setSessionCookie({
      memberId: result.member.id,
      clubId: result.club.id,
      isAdmin: true,
      name: result.member.name,
    });

    await sendEmail({
      to: result.member.email,
      subject: `Your ${result.club.name} consent confirmation`,
      body: consentReceiptBody({
        clubName: result.club.name,
        playerName: result.member.name,
        acceptedAt: result.member.consent_at,
      }),
    });

    return ok({ ok: true, inviteCode: result.club.invite_code });
  } catch (err) {
    return handleError(err);
  }
}
