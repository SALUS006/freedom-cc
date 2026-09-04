import type { NextRequest } from "next/server";
import { one, tx } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { CONSENT_VERSION, consentReceiptBody } from "@/lib/consent";
import { sendEmail } from "@/lib/email";
import { handleError, fail, ok } from "@/lib/api";
import type { Club } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const club = await one<Club>(`select * from clubs where invite_code = $1`, [
      body.inviteCode.toUpperCase(),
    ]);
    if (!club) return fail(404, "That invite code doesn't match any club");

    const dupe = await one(
      `select 1 from members where club_id = $1 and lower(email) = lower($2)`,
      [club.id, body.email]
    );
    if (dupe) return fail(409, "That email is already registered");

    const passwordHash = await hashPassword(body.password);
    const member = await tx(async (client) => {
      const res = await client.query(
        `insert into members (club_id, name, email, phone, password_hash,
           consent_version, consent_at, consent_ip)
         values ($1,$2,$3,$4,$5,$6, now(), $7)
         returning id, name, email, is_admin, consent_at`,
        [club.id, body.name, body.email, body.phone || null, passwordHash, CONSENT_VERSION, ip]
      );
      return res.rows[0];
    });

    await setSessionCookie({
      memberId: member.id,
      clubId: club.id,
      isAdmin: member.is_admin,
      name: member.name,
    });

    await sendEmail({
      to: member.email,
      subject: `Your ${club.name} consent confirmation`,
      body: consentReceiptBody({
        clubName: club.name,
        playerName: member.name,
        acceptedAt: member.consent_at,
      }),
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
