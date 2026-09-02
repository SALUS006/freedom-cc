import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { one } from "@/lib/db";
import { adminMembers } from "@/lib/data";
import type { Club } from "@/lib/types";
import { AdminConsole } from "./AdminConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Freedom CC" };

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/admin/sign-in");
  if (!session.isAdmin) redirect("/");

  const club = await one<Club>(`select * from clubs where id = $1`, [session.clubId]);
  if (!club) redirect("/create-club");
  const members = await adminMembers(session.clubId);

  return (
    <div style={{ paddingTop: "calc(var(--safe-t) + 12px)" }}>
      <div className="screen-head">
        <h1>Admin</h1>
        <Link href="/" className="pill brand">
          Open app
        </Link>
      </div>
      <p className="muted small" style={{ marginTop: -6 }}>
        {club.name}
      </p>

      <AdminConsole clubName={club.name} inviteCode={club.invite_code} members={members} />
    </div>
  );
}
