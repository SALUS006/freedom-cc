export interface BalancePlayer {
  id: string;
  name: string;
  bat: number;
  bowl: number;
  field: number;
  isKeeper: boolean;
  matches: number;
}

export interface SideReport {
  overall: number;
  topOrder: number;
  tail: number;
  canBat: number;
  bowlingOptions: number;
  frontlineBowlers: number;
  oversCoverable: number;
  keepers: number;
  allRounders: number;
  avgExperience: number;
  strengths: string[];
  weaknesses: string[];
}

export interface BalanceReport {
  a: SideReport;
  b: SideReport;
  verdict: string;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function analyseSide(players: BalancePlayer[], overs: number, maxPerBowler: number): SideReport {
  const byBat = [...players].sort((p, q) => q.bat - p.bat);
  const topOrder = round1(avg(byBat.slice(0, 7).map((p) => p.bat)));
  const tail = round1(avg(byBat.slice(7).map((p) => p.bat)));
  const canBat = players.filter((p) => p.bat >= 6).length;

  const bowlingOptions = players.filter((p) => p.bowl >= 5).length;
  const frontlineBowlers = players.filter((p) => p.bowl >= 7).length;
  const oversCoverable = bowlingOptions * maxPerBowler;
  const keepers = players.filter((p) => p.isKeeper).length;
  const allRounders = players.filter((p) => p.bat >= 6 && p.bowl >= 6).length;
  const avgExperience = round1(avg(players.map((p) => p.matches)));

  const battingScore = avg(byBat.slice(0, Math.min(7, players.length)).map((p) => p.bat));
  const bowlScore = avg(
    [...players].sort((a, b) => b.bowl - a.bowl).slice(0, 5).map((p) => p.bowl)
  );
  const fieldScore = avg(players.map((p) => p.field));
  const depthScore = Math.min(10, canBat + bowlingOptions);
  const overall = round1(
    0.35 * battingScore + 0.35 * bowlScore + 0.15 * fieldScore + 0.15 * depthScore
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (canBat >= 8) strengths.push(`Deep batting — ${canBat} players rated 6+`);
  else if (canBat <= 4) weaknesses.push(`Thin batting — only ${canBat} players rated 6+`);
  if (tail > 0 && tail < 3.5 && players.length > 7)
    weaknesses.push(`Long tail — positions 8+ average ${tail.toFixed(1)}`);
  if (frontlineBowlers >= 4) strengths.push(`${frontlineBowlers} frontline bowlers`);

  const bowlersNeeded = Math.ceil(overs / maxPerBowler);
  if (frontlineBowlers < bowlersNeeded) {
    const shortfall = (bowlersNeeded - frontlineBowlers) * maxPerBowler;
    weaknesses.push(
      `Only ${frontlineBowlers} frontline bowlers for ${overs} overs — ~${shortfall} over${
        shortfall === 1 ? "" : "s"
      } must come from part-timers`
    );
  }
  if (bowlingOptions < bowlersNeeded)
    weaknesses.push(`Cannot legally cover ${overs} overs at ${maxPerBowler} each without more bowlers`);

  if (keepers === 0) weaknesses.push("No specialist wicket-keeper");
  else if (keepers === 1) weaknesses.push("No backup keeper");
  else strengths.push("Keeping covered with a backup");

  if (allRounders >= 2) strengths.push(`${allRounders} genuine all-rounders`);
  if (fieldScore >= 6.8) strengths.push(`Sharp fielding unit (avg ${fieldScore.toFixed(1)})`);
  if (avgExperience > 0 && avgExperience < 3) weaknesses.push("Very inexperienced side");

  if (strengths.length === 0) strengths.push("Balanced, no standout strength");
  if (weaknesses.length === 0) weaknesses.push("No obvious weakness");

  return {
    overall,
    topOrder,
    tail,
    canBat,
    bowlingOptions,
    frontlineBowlers,
    oversCoverable,
    keepers,
    allRounders,
    avgExperience,
    strengths,
    weaknesses,
  };
}

export function balanceReport(
  aPlayers: BalancePlayer[],
  bPlayers: BalancePlayer[],
  overs: number,
  maxPerBowler: number,
  aName = "Side A",
  bName = "Side B"
): BalanceReport {
  const a = analyseSide(aPlayers, overs, maxPerBowler);
  const b = analyseSide(bPlayers, overs, maxPerBowler);

  let verdict: string;
  const gap = round1(a.overall - b.overall);
  if (Math.abs(gap) < 0.4) {
    verdict = "Evenly matched on paper — the toss and conditions decide this one.";
  } else {
    const strong = gap > 0 ? aName : bName;
    const weak = gap > 0 ? bName : aName;
    const strongSide = gap > 0 ? a : b;
    const weakSide = gap > 0 ? b : a;
    const edge =
      strongSide.canBat - weakSide.canBat >= 2
        ? "batting depth"
        : strongSide.frontlineBowlers - weakSide.frontlineBowlers >= 1
          ? "the stronger attack"
          : "the more balanced XI";
    verdict = `${strong} look stronger by ${Math.abs(gap).toFixed(1)} on ${edge}. ${weak} need early wickets or a flying start.`;
  }

  return { a, b, verdict };
}

export function maxOversPerBowler(overs: number): number {
  return Math.max(1, Math.ceil(overs / 5));
}
