import type { NextRequest } from "next/server";
import { one } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/session";
import { deleteAvatar, storeAvatarFromRequest } from "@/lib/avatar";
import { handleError, ok } from "@/lib/api";

async function assertAdminOwnsPlayer(id: string) {
  const session = await requireSession();
  if (!session.isAdmin) throw new HttpError(403, "Admins only");
  const member = await one(`select 1 from members where id = $1 and club_id = $2`, [
    id,
    session.clubId,
  ]);
  if (!member) throw new HttpError(404, "Player not found");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertAdminOwnsPlayer(id);
    await storeAvatarFromRequest(req, id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await assertAdminOwnsPlayer(id);
    await deleteAvatar(id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
