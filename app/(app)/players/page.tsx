import Link from "next/link";
import { currentClub, listMembers } from "@/lib/data";
import { blendedRating } from "@/lib/rating";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  batter: "BAT",
  bowler: "BOWL",
  keeper: "WK",
  allrounder: "AR",
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default async function Players() {
  const club = await currentClub();
  if (!club) return null;
  const members = await listMembers(club.id);

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
          const bat = blendedRating(m.bat_self, null, 0);
          const bowl = blendedRating(m.bowl_self, null, 0);
          const roles = m.roles.map((r) => ROLE_LABEL[r] ?? r);
          if (m.is_keeper && !m.roles.includes("keeper")) roles.push("WK");
          return (
            <Link key={m.id} href={`/players/${m.id}`} className="list-tap">
              <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <span
                  className="crest"
                  style={{ width: 34, height: 34, borderRadius: 10, fontSize: "0.9rem" }}
                >
                  {initials(m.name)}
                </span>
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
