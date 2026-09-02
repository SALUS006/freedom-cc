import { clearSessionCookie } from "@/lib/session";
import { ok } from "@/lib/api";

export async function POST() {
  await clearSessionCookie();
  return ok({ ok: true });
}
