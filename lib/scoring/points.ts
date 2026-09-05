import type { BowlerCard, InningsState } from "./types";

export type Side = "a" | "b";

export interface PlayerMatchStat {
  memberId: string;
  side: Side;
  isCaptain: boolean;
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  howOut: string | null; // WicketType | "not_out" | "retired_not_out" | null (did not bat)
  bowled: boolean;
  legalBalls: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  batPoints: number;
  bowlPoints: number;
  fieldPoints: number;
  resultPoints: number;
  totalPoints: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Points for one batting innings. Boundary/milestone/SR bonuses stack on the base run count. */
export function battingPoints(runs: number, balls: number, fours: number, sixes: number, howOut: string): number {
  let pts = runs + fours + sixes * 2;
  if (runs >= 25) pts += 4;
  if (runs >= 50) pts += 8;
  if (runs >= 100) pts += 16;

  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr >= 150) pts += 6;
    else if (sr >= 130) pts += 4;
    else if (sr >= 100) pts += 2;
    else if (sr >= 60) pts += 0;
    else if (sr >= 40) pts -= 2;
    else pts -= 4;
  }

  const isOut = howOut !== "not_out" && howOut !== "retired_not_out";
  if (!isOut && balls >= 1) pts += 2; // survived to the end
  if (isOut && runs === 0) pts -= 2; // duck

  return round1(pts);
}

/** Points for one bowling spell. */
export function bowlingPoints(card: Pick<BowlerCard, "balls" | "runs" | "wickets" | "maidens" | "dots">): number {
  let pts = card.wickets * 20;
  if (card.wickets >= 5) pts += 16;
  else if (card.wickets >= 3) pts += 8;
  pts += card.maidens * 8;
  pts += card.dots * 0.25;

  if (card.balls >= 12) {
    const overs = card.balls / 6;
    const econ = card.runs / overs;
    if (econ < 4) pts += 6;
    else if (econ < 5) pts += 4;
    else if (econ < 6) pts += 2;
    else if (econ < 7) pts += 0;
    else if (econ < 8) pts -= 2;
    else if (econ < 9) pts -= 4;
    else pts -= 6;
  }

  return round1(pts);
}

export const FIELDING_POINTS = { catch: 8, stumping: 10, runOut: 8 } as const;
export const RESULT_POINTS = { win: 4, captainBonus: 2 } as const;

export interface MatchStatsInput {
  squad: { memberId: string; side: Side; isCaptain: boolean }[];
  innings: { battingSide: Side; state: InningsState }[];
  winner: Side | null;
}

/** Folds both innings' derived state into one points row per squad member. */
export function computeMatchStats({ squad, innings, winner }: MatchStatsInput): PlayerMatchStat[] {
  const rows = new Map<string, PlayerMatchStat>();
  const get = (memberId: string, side: Side, isCaptain = false): PlayerMatchStat => {
    let r = rows.get(memberId);
    if (!r) {
      r = {
        memberId,
        side,
        isCaptain,
        batted: false,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        howOut: null,
        bowled: false,
        legalBalls: 0,
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        batPoints: 0,
        bowlPoints: 0,
        fieldPoints: 0,
        resultPoints: 0,
        totalPoints: 0,
      };
      rows.set(memberId, r);
    }
    return r;
  };

  for (const s of squad) get(s.memberId, s.side, s.isCaptain);

  for (const inn of innings) {
    const fieldingSide: Side = inn.battingSide === "a" ? "b" : "a";

    for (const card of inn.state.batters) {
      const r = get(card.id, inn.battingSide);
      r.batted = true;
      r.runs = card.runs;
      r.balls = card.balls;
      r.fours = card.fours;
      r.sixes = card.sixes;
      r.howOut = card.retiredNotOut ? "retired_not_out" : (card.out ?? "not_out");
      r.batPoints = battingPoints(r.runs, r.balls, r.fours, r.sixes, r.howOut);

      if (card.out && card.outFielderId) {
        const f = get(card.outFielderId, fieldingSide);
        if (card.out === "caught") {
          f.catches += 1;
          f.fieldPoints += FIELDING_POINTS.catch;
        } else if (card.out === "stumped") {
          f.stumpings += 1;
          f.fieldPoints += FIELDING_POINTS.stumping;
        } else if (card.out === "run_out") {
          f.runOuts += 1;
          f.fieldPoints += FIELDING_POINTS.runOut;
        }
      }
    }

    for (const card of inn.state.bowlers) {
      const r = get(card.id, fieldingSide);
      r.bowled = true;
      r.legalBalls = card.balls;
      r.runsConceded = card.runs;
      r.wickets = card.wickets;
      r.maidens = card.maidens;
      r.bowlPoints = bowlingPoints(card);
    }
  }

  if (winner) {
    for (const s of squad) {
      if (s.side !== winner) continue;
      const r = get(s.memberId, s.side, s.isCaptain);
      r.resultPoints = RESULT_POINTS.win + (s.isCaptain ? RESULT_POINTS.captainBonus : 0);
    }
  }

  for (const r of rows.values()) {
    r.totalPoints = round1(r.batPoints + r.bowlPoints + r.fieldPoints + r.resultPoints);
  }

  return [...rows.values()];
}

/** Highest total wins; ties break on wickets, then runs, then name (deterministic). */
export function pickManOfMatch(stats: PlayerMatchStat[], names: Record<string, string>): string | null {
  if (stats.length === 0) return null;
  const sorted = [...stats].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    if (b.runs !== a.runs) return b.runs - a.runs;
    return (names[a.memberId] ?? "").localeCompare(names[b.memberId] ?? "");
  });
  return sorted[0].memberId;
}

/** A compact "58 (34) & 2/18, 1ct" summary line for a player's match. */
export function statLine(s: PlayerMatchStat): string {
  const parts: string[] = [];
  if (s.batted) parts.push(`${s.runs} (${s.balls})`);
  if (s.bowled) parts.push(`${s.wickets}/${s.runsConceded}`);
  const fielding: string[] = [];
  if (s.catches) fielding.push(`${s.catches}ct`);
  if (s.stumpings) fielding.push(`${s.stumpings}st`);
  if (s.runOuts) fielding.push(`${s.runOuts}ro`);
  if (fielding.length) parts.push(fielding.join(" "));
  return parts.join(" & ") || "—";
}
