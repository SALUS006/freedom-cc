import type { NextRequest } from "next/server";
import { one, tx } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { invitePlayerSchema } from "@/lib/validation";
import { hashPassword, randomCode } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { inviteEmailBody } from "@/lib/consent";
import { handleError, fail, ok } from "@/lib/api";
import type { Club } from "@/lib/types";

function tempPassword() {
  return `${randomCode(4)}-${randomCode(4)}`;
}

function appUrl(req: NextRequest) {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ??
    `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`
  );
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (!session.isAdmin) throw new HttpError(403, "Admins only");
    const body = invitePlayerSchema.parse(await req.json());

    const club = await one<Club>(`select * from clubs where id = $1`, [session.clubId]);
    if (!club) return fail(404, "Club not found");

    const dupe = await one(
      `select 1 from members where club_id = $1 and lower(email) = lower($2)`,
      [session.clubId, body.email]
    );
    if (dupe) return fail(409, "That email is already in the club");

    const temp = tempPassword();
    const passwordHash = await hashPassword(temp);

    const member = await tx(async (client) => {
      const res = await client.query(
        `insert into members (club_id, name, email, password_hash, password_reset_required, invited_by)
         values ($1,$2,$3,$4,true,$5)
         returning id, name, email`,
        [session.clubId, body.name, body.email, passwordHash, session.memberId]
      );
      return res.rows[0];
    });

    const bodyText = inviteEmailBody({
      clubName: club.name,
      invitedBy: session.name,
      playerName: member.name,
      email: member.email,
      tempPassword: temp,
      signInUrl: `${appUrl(req)}/sign-in`,
    });
    const emailStatus = await sendEmail({
      to: member.email,
      subject: `You've been added to ${club.name} on Freedom CC`,
      body: bodyText,
    });

    return ok({
      ok: true,
      memberId: member.id,
      emailStatus,
      // Surfaced so an admin can relay it manually when no mail server is configured.
      tempPassword: emailStatus === "sent" ? undefined : temp,
    });
  } catch (err) {
    return handleError(err);
  }
}
