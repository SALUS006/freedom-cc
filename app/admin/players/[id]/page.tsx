import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { adminMember } from "@/lib/data";
import { AdminPlayerEdit } from "./AdminPlayerEdit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit player · Freedom CC" };

export default async function AdminPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/admin/sign-in");
  if (!session.isAdmin) redirect("/");
  const { id } = await params;
  const member = await adminMember(id, session.clubId);
  if (!member) notFound();

  return (
    <div style={{ paddingTop: "calc(var(--safe-t) + 12px)" }}>
      <div className="screen-head">
        <Link className="back" href="/admin" aria-label="Back">
          ‹
        </Link>
        <h1>Edit player</h1>
      </div>
      <AdminPlayerEdit
        memberId={member.id}
        name={member.name}
        email={member.email}
        hasAvatar={member.has_avatar}
        isAdmin={member.is_admin}
        pending={!member.consent_at}
      />
    </div>
  );
}
