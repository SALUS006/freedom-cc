import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { makeResetToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { handleError, fail, ok } from "@/lib/api";
import type { Club } from "@/lib/types";

function appUrl(req: NextRequest) {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ??
    `${req.headers.get("x-forwarded-proto") ?? "http"}://${req.headers.get("host")}`
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session.isAdmin) throw new HttpError(403, "Admins only");
    const { id } = await params;

    const member = await one<{ id: string; name: string; email: string }>(
      `select id, name, email from members where id = $1 and club_id = $2`,
      [id, session.clubId]
    );
    if (!member) return fail(404, "Player not found");

    const { token, hash } = makeResetToken();
    await query(
      `insert into password_resets (member_id, token_hash, expires_at)
       values ($1, $2, now() + interval '1 hour')`,
      [member.id, hash]
    );
    const club = await one<Club>(`select name from clubs where id = $1`, [session.clubId]);
    const link = `${appUrl(req)}/reset-password?token=${token}`;
    const emailStatus = await sendEmail({
      to: member.email,
      subject: `Reset your ${club?.name ?? "Freedom CC"} password`,
      body: [
        `Hi ${member.name},`,
        ``,
        `${session.name} started a password reset for your account.`,
        `Use this link within the next hour to set a new password:`,
        `  ${link}`,
      ].join("\n"),
    });

    return ok({ ok: true, emailStatus, resetLink: emailStatus === "sent" ? undefined : link });
  } catch (err) {
    return handleError(err);
  }
}
