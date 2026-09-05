import Link from "next/link";
import { currentClub, listMembers } from "@/lib/data";
import { computeClubPlayerRatings } from "@/lib/player-ratings";
import { Avatar } from "@/app/components/Avatar";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  batter: "BAT",
  bowler: "BOWL",
  keeper: "WK",
  allrounder: "AR",
};

export default async function Players() {
  const club = await currentClub();
  if (!club) return null;
  const members = await listMembers(club.id);
  const ratings = await computeClubPlayerRatings(club.id, members);

  return (
    <div>
      <div className="screen-head">
        <h1>Players</h1>
      </div>
      <p className="muted small" style={{ marginTop: -6 }}>
        {members.length} registered
      </p>

      <div className="card flush">
        {members.map((m) => {
          const r = ratings.get(m.id);
          const bat = r?.bat ?? m.bat_self;
          const bowl = r?.bowl ?? m.bowl_self;
          const roles = m.roles.map((r2) => ROLE_LABEL[r2] ?? r2);
          if (m.is_keeper && !m.roles.includes("keeper")) roles.push("WK");
          return (
            <Link key={m.id} href={`/players/${m.id}`} className="list-tap">
              <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar memberId={m.id} name={m.name} hasAvatar={m.has_avatar} size={36} />
                <span style={{ minWidth: 0 }}>
                  <span className="lead">{m.name}</span>
                  <div className="sub">{roles.join(" · ") || "no role set"}</div>
                </span>
              </span>
              <span
                className="sub"
                style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", flex: "none" }}
              >
                bat {bat.toFixed(1)}
                <br />
                bowl {bowl.toFixed(1)}
              </span>
            </Link>
          );
        })}
        {members.length === 0 && (
          <p className="muted small" style={{ padding: 12 }}>
            No players yet.
          </p>
        )}
      </div>
    </div>
  );
}
