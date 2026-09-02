import { requireSession } from "@/lib/session";
import { loadMatchBundle } from "@/lib/match";
import { handleError, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const bundle = await loadMatchBundle(id);
    if (!bundle) return fail(404, "Match not found");
    return ok(bundle);
  } catch (err) {
    return handleError(err);
  }
}
