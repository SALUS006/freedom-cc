import "server-only";
import { query } from "./db";
import { HttpError } from "./session";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB (clients resize to ~256px first)
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Reads an uploaded avatar from a multipart request and stores it against a member. */
export async function storeAvatarFromRequest(req: Request, memberId: string): Promise<void> {
  const form = await req.formData();
  const file = form.get("avatar");
  if (!(file instanceof Blob)) throw new HttpError(400, "No image uploaded");
  if (!ALLOWED.has(file.type)) throw new HttpError(400, "Use a JPEG, PNG or WebP image");
  if (file.size === 0) throw new HttpError(400, "Empty file");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Image too large (max 2 MB)");

  const buf = Buffer.from(await file.arrayBuffer());
  await query(
    `insert into member_avatars (member_id, data, content_type, updated_at)
     values ($1, $2, $3, now())
     on conflict (member_id)
       do update set data = excluded.data, content_type = excluded.content_type, updated_at = now()`,
    [memberId, buf, file.type]
  );
  await query(`update members set has_avatar = true where id = $1`, [memberId]);
}

export async function deleteAvatar(memberId: string): Promise<void> {
  await query(`delete from member_avatars where member_id = $1`, [memberId]);
  await query(`update members set has_avatar = false where id = $1`, [memberId]);
}

export async function readAvatar(
  memberId: string
): Promise<{ data: Buffer; contentType: string; updatedAt: string } | null> {
  const row = await query<{ data: Buffer; content_type: string; updated_at: string }>(
    `select data, content_type, updated_at from member_avatars where member_id = $1`,
    [memberId]
  );
  if (!row[0]) return null;
  return { data: row[0].data, contentType: row[0].content_type, updatedAt: row[0].updated_at };
}
