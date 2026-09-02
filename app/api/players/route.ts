import { requireSession } from "@/lib/session";
import { listMembers } from "@/lib/data";
import { handleError, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const members = await listMembers(session.clubId);
    return ok(members);
  } catch (err) {
    return handleError(err);
  }
}
