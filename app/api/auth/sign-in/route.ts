import type { NextRequest } from "next/server";
import { one } from "@/lib/db";
import { signInSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { handleError, fail, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = signInSchema.parse(await req.json());
    const member = await one<{
      id: string;
      club_id: string;
      name: string;
      is_admin: boolean;
      password_hash: string;
      consent_at: string | null;
      password_reset_required: boolean;
    }>(
      `select id, club_id, name, is_admin, password_hash, consent_at, password_reset_required
         from members where lower(email) = lower($1)`,
      [body.email]
    );
    if (!member || !(await verifyPassword(body.password, member.password_hash))) {
      return fail(401, "Wrong email or password");
    }
    await setSessionCookie({
      memberId: member.id,
      clubId: member.club_id,
      isAdmin: member.is_admin,
      name: member.name,
    });
    return ok({
      ok: true,
      isAdmin: member.is_admin,
      needsOnboarding: !member.consent_at || member.password_reset_required,
    });
  } catch (err) {
    return handleError(err);
  }
}
