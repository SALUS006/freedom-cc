import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation";
import { makeResetToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { handleError, ok } from "@/lib/api";
import type { Club } from "@/lib/types";

function appUrl(req: NextRequest) {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ??
    `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await req.json());

    const member = await one<{ id: string; name: string; email: string; club_id: string }>(
      `select id, name, email, club_id from members where lower(email) = lower($1)`,
      [body.email]
    );

    // Always answer the same way — don't reveal whether the email is registered.
    if (member) {
      const { token, hash } = makeResetToken();
      await query(
        `insert into password_resets (member_id, token_hash, expires_at)
         values ($1, $2, now() + interval '1 hour')`,
        [member.id, hash]
      );
      const club = await one<Club>(`select name from clubs where id = $1`, [member.club_id]);
      const link = `${appUrl(req)}/reset-password?token=${token}`;
      await sendEmail({
        to: member.email,
        subject: `Reset your ${club?.name ?? "Freedom CC"} password`,
        body: [
          `Hi ${member.name},`,
          ``,
          `Use this link within the next hour to set a new password:`,
          `  ${link}`,
          ``,
          `If you didn't ask for this, ignore this email — your password won't change.`,
        ].join("\n"),
      });
    }

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
