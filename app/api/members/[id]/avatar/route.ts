import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { one } from "@/lib/db";
import { readAvatar } from "@/lib/avatar";
import { handleError, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const member = await one<{ id: string }>(
      `select id from members where id = $1 and club_id = $2`,
      [id, session.clubId]
    );
    if (!member) return fail(404, "Not found");

    const avatar = await readAvatar(id);
    if (!avatar) return fail(404, "No avatar");

    return new NextResponse(new Uint8Array(avatar.data), {
      headers: {
        "content-type": avatar.contentType,
        "cache-control": "private, max-age=300",
        "last-modified": new Date(avatar.updatedAt).toUTCString(),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
