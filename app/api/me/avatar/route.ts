import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/session";
import { deleteAvatar, storeAvatarFromRequest } from "@/lib/avatar";
import { handleError, ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    await storeAvatarFromRequest(req, session.memberId);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    await deleteAvatar(session.memberId);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
