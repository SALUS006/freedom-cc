import Link from "next/link";
import { notFound } from "next/navigation";
import { one } from "@/lib/db";
import { getSession } from "@/lib/session";
import { memberMatchCount, motmCounts } from "@/lib/data";
import { computeClubPlayerRatings } from "@/lib/player-ratings";
import { Avatar } from "@/app/components/Avatar";
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
  const ratings = session?.clubId ? await computeClubPlayerRatings(session.clubId, [member]) : new Map();
  const rating = ratings.get(member.id);
  const motm = session?.clubId ? (await motmCounts(session.clubId)).get(member.id) ?? 0 : 0;

  return (
    <div>
      <div className="screen-head">
        <Link className="back" href="/players" aria-label="Back">
          ‹
        </Link>
        <h1>{member.name}</h1>
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 14px" }}>
        <Avatar memberId={member.id} name={member.name} hasAvatar={member.has_avatar} size={96} />
      </div>

      <div className="chip-select" style={{ marginBottom: 6, justifyContent: "center" }}>
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
        {motm > 0 && (
          <span className="pill turf" title="Man of the Match awards">
            🏅 MOTM ×{motm}
          </span>
        )}
      </div>

      <div className="card">
        <Bar label="Batting" value={rating ? rating.bat : member.bat_self} />
        <Bar label="Bowling" value={rating ? rating.bowl : member.bowl_self} />
        <Bar label="Fielding" value={rating ? rating.field : member.field_self} />
        <p className="small muted" style={{ marginBottom: 0 }}>
          {rating && rating.matches >= 3
            ? "Blended from self-rating and match performance."
            : "Self-rated. Blends in match performance after a few completed matches."}
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
