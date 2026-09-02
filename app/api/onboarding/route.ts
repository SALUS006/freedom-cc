import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { onboardingSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { CONSENT_VERSION } from "@/lib/consent";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = onboardingSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    await query(
      `update members set
         password_hash = $2,
         password_reset_required = false,
         consent_version = $3,
         consent_at = now(),
         consent_ip = $4
       where id = $1`,
      [session.memberId, await hashPassword(body.password), CONSENT_VERSION, ip]
    );

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
