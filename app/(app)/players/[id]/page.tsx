import Link from "next/link";
import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { getSession } from "@/lib/session";
import { memberMatchCount } from "@/lib/data";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  batter: "Batter",
  bowler: "Bowler",
  keeper: "Wicket-keeper",
  allrounder: "All-rounder",
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ margin: "10px 0" }}>
      <div className="row small">
        <span className="muted">{label}</span>
        <strong>{value}/10</strong>
      </div>
      <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 999, marginTop: 4 }}>
        <div
          style={{
            width: `${value * 10}%`,
            height: "100%",
            background: "var(--turf)",
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

export default async function PlayerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const member = await one<Member>(`select * from members where id = $1 and club_id = $2`, [
    id,
    session?.clubId,
  ]);
  if (!member) notFound();
  const matches = await memberMatchCount(member.id);
  const isMe = session?.memberId === member.id;

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href="/players" aria-label="Back">
          ‹
        </Link>
        <h1>{member.name}</h1>
      </div>

      <div className="chip-select" style={{ marginBottom: 6 }}>
        {member.roles.map((r) => (
          <span key={r} className="pill turf">
            {ROLE_LABEL[r] ?? r}
          </span>
        ))}
        {member.is_keeper && !member.roles.includes("keeper") && <span className="pill turf">Wicket-keeper</span>}
        {member.happy_to_captain && <span className="pill">Happy to captain</span>}
        {member.roles.length === 0 && !member.is_keeper && (
          <span className="pill">No role set</span>
        )}
      </div>

      <div className="card">
        <Bar label="Batting" value={member.bat_self} />
        <Bar label="Bowling" value={member.bowl_self} />
        <Bar label="Fielding" value={member.field_self} />
        <p className="small muted" style={{ marginBottom: 0 }}>
          Self-rated. Earned ratings from match performance arrive in a later update.
        </p>
      </div>

      <div className="card tight">
        <div className="row">
          <span className="muted small">Matches played</span>
          <strong>{matches}</strong>
        </div>
        {member.batting_style && (
          <div className="row">
            <span className="muted small">Batting</span>
            <span>{member.batting_style === "left" ? "Left-hand" : "Right-hand"}</span>
          </div>
        )}
        {member.bowling_type && (
          <div className="row">
            <span className="muted small">Bowling</span>
            <span>{member.bowling_type}</span>
          </div>
        )}
      </div>

      {isMe && (
        <Link className="btn btn-ghost btn-block" href="/profile">
          Edit my profile
        </Link>
      )}
    </div>
  );
}
