import type { NextRequest } from "next/server";
import { one, query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { onboardingSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { CONSENT_VERSION, consentReceiptBody } from "@/lib/consent";
import { sendEmail } from "@/lib/email";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = onboardingSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const member = await one<{ email: string; consent_at: string }>(
      `update members set
         password_hash = $2,
         password_reset_required = false,
         consent_version = $3,
         consent_at = now(),
         consent_ip = $4
       where id = $1
       returning email, consent_at`,
      [session.memberId, await hashPassword(body.password), CONSENT_VERSION, ip]
    );

    if (member) {
      const club = await one<{ name: string }>(`select name from clubs where id = $1`, [
        session.clubId,
      ]);
      await sendEmail({
        to: member.email,
        subject: `Your ${club?.name ?? "Freedom CC"} consent confirmation`,
        body: consentReceiptBody({
          clubName: club?.name ?? "Freedom CC",
          playerName: session.name,
          acceptedAt: member.consent_at,
        }),
      });
    }

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
