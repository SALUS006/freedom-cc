import type { NextRequest } from "next/server";
import { one } from "@/lib/db";
import { query } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { reinviteSchema } from "@/lib/validation";
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
    const body = reinviteSchema.parse(await req.json());

    const club = await one<Club>(`select * from clubs where id = $1`, [session.clubId]);
    const member = await one<{ id: string; name: string; email: string; consent_at: string | null }>(
      `select id, name, email, consent_at from members where id = $1 and club_id = $2`,
      [body.memberId, session.clubId]
    );
    if (!club || !member) return fail(404, "Player not found");
    if (member.consent_at) return fail(409, "That player has already completed sign-up");

    const temp = tempPassword();
    await query(
      `update members set password_hash = $2, password_reset_required = true where id = $1`,
      [member.id, await hashPassword(temp)]
    );

    const emailStatus = await sendEmail({
      to: member.email,
      subject: `Reminder: finish joining ${club.name} on Freedom CC`,
      body: inviteEmailBody({
        clubName: club.name,
        invitedBy: session.name,
        playerName: member.name,
        email: member.email,
        tempPassword: temp,
        signInUrl: `${appUrl(req)}/sign-in`,
      }),
    });

    return ok({ ok: true, emailStatus, tempPassword: emailStatus === "sent" ? undefined : temp });
  } catch (err) {
    return handleError(err);
  }
}
