import "server-only";
import { matchStatsForClub } from "./data";
import { blendedRating } from "./rating";
import type { Member } from "./types";

const MIN_SAMPLE = 3; // innings/matches needed before a skill's earned rating counts

export interface PlayerRatingInfo {
  bat: number;
  bowl: number;
  field: number;
  matches: number; // completed matches with recorded stats
  earnedBat: number | null;
  earnedBowl: number | null;
  earnedField: number | null;
}

interface Agg {
  batPtsSum: number;
  batInnings: number;
  bowlPtsSum: number;
  bowlInnings: number;
  fieldPtsSum: number;
  matches: number;
}

function clampRating(n: number): number {
  return Math.min(10, Math.max(1, n));
}

/** The 90th-percentile value in a list, so one outlier can't peg the scale. */
function percentile90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.9 * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Earned rating per skill = clamp(1, 10, 2 + 8 * (player's points-per-unit /
 * club's 90th-percentile points-per-unit)), blended with self-rating via the
 * existing decay in lib/rating.ts. Requires >= 3 innings/matches of that kind;
 * before that, `blendedRating` falls back to the self-rating untouched.
 */
export async function computeClubPlayerRatings(
  clubId: string,
  members: Pick<Member, "id" | "bat_self" | "bowl_self" | "field_self">[]
): Promise<Map<string, PlayerRatingInfo>> {
  const rows = await matchStatsForClub(clubId);

  const agg = new Map<string, Agg>();
  const get = (id: string): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { batPtsSum: 0, batInnings: 0, bowlPtsSum: 0, bowlInnings: 0, fieldPtsSum: 0, matches: 0 };
      agg.set(id, a);
    }
    return a;
  };
  for (const r of rows) {
    const a = get(r.member_id);
    a.matches += 1;
    if (r.batted) {
      a.batPtsSum += r.bat_points;
      a.batInnings += 1;
    }
    if (r.bowled) {
      a.bowlPtsSum += r.bowl_points;
      a.bowlInnings += 1;
    }
    a.fieldPtsSum += r.field_points;
  }

  const batP90 = percentile90(
    [...agg.values()].filter((a) => a.batInnings >= MIN_SAMPLE).map((a) => a.batPtsSum / a.batInnings)
  );
  const bowlP90 = percentile90(
    [...agg.values()].filter((a) => a.bowlInnings >= MIN_SAMPLE).map((a) => a.bowlPtsSum / a.bowlInnings)
  );
  const fieldP90 = percentile90(
    [...agg.values()].filter((a) => a.matches >= MIN_SAMPLE).map((a) => a.fieldPtsSum / a.matches)
  );

  const out = new Map<string, PlayerRatingInfo>();
  for (const m of members) {
    const a = agg.get(m.id);
    const matches = a?.matches ?? 0;

    const earnedBat =
      a && a.batInnings >= MIN_SAMPLE && batP90 > 0
        ? clampRating(2 + 8 * (a.batPtsSum / a.batInnings / batP90))
        : null;
    const earnedBowl =
      a && a.bowlInnings >= MIN_SAMPLE && bowlP90 > 0
        ? clampRating(2 + 8 * (a.bowlPtsSum / a.bowlInnings / bowlP90))
        : null;
    const earnedField =
      a && a.matches >= MIN_SAMPLE && fieldP90 > 0
        ? clampRating(2 + 8 * (a.fieldPtsSum / a.matches / fieldP90))
        : null;

    out.set(m.id, {
      bat: blendedRating(m.bat_self, earnedBat, matches),
      bowl: blendedRating(m.bowl_self, earnedBowl, matches),
      field: blendedRating(m.field_self, earnedField, matches),
      matches,
      earnedBat,
      earnedBowl,
      earnedField,
    });
  }
  return out;
}
