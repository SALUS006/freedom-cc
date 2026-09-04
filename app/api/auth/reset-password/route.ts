import type { NextRequest } from "next/server";
import { one, query, tx } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword, hashToken } from "@/lib/auth";
import { handleError, fail, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await req.json());
    const tokenHash = hashToken(body.token);

    const reset = await one<{ id: string; member_id: string }>(
      `select id, member_id from password_resets
        where token_hash = $1 and used_at is null and expires_at > now()
        order by created_at desc limit 1`,
      [tokenHash]
    );
    if (!reset) return fail(400, "That reset link is invalid or has expired");

    await tx(async (client) => {
      await client.query(
        `update members set password_hash = $2, password_reset_required = false where id = $1`,
        [reset.member_id, await hashPassword(body.password)]
      );
      await client.query(`update password_resets set used_at = now() where id = $1`, [reset.id]);
      // burn any other outstanding tokens for this member
      await client.query(
        `update password_resets set used_at = now() where member_id = $1 and used_at is null`,
        [reset.member_id]
      );
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
