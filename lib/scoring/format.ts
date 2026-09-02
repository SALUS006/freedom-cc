import type { BatterCard, BowlerCard, InningsState, WicketType } from "./types";

export type NameMap = Record<string, string>;

export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export function dismissalText(card: BatterCard, names: NameMap): string {
  if (card.retiredNotOut) return "retired not out";
  if (!card.out) return card.onCrease ? "not out" : "did not bat";
  const bowlerName = card.outBowlerId ? shortName(names[card.outBowlerId] ?? "?") : "?";
  const fielderName = card.outFielderId ? shortName(names[card.outFielderId] ?? "?") : null;
  const map: Record<WicketType, string> = {
    bowled: `b ${bowlerName}`,
    lbw: `lbw b ${bowlerName}`,
    caught: fielderName ? `c ${fielderName} b ${bowlerName}` : `c & b ${bowlerName}`,
    stumped: `st ${fielderName ?? "?"} b ${bowlerName}`,
    hit_wicket: `hit wkt b ${bowlerName}`,
    run_out: fielderName ? `run out (${fielderName})` : "run out",
    obstructing: "obstructing the field",
    retired_out: "retired out",
  };
  return map[card.out];
}

export function oversFromBalls(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export function strikeRate(runs: number, balls: number): string {
  return balls === 0 ? "0.0" : ((runs / balls) * 100).toFixed(1);
}

export function economy(runs: number, balls: number): string {
  return balls === 0 ? "0.00" : ((runs / (balls / 6))).toFixed(2);
}

export function runRate(runs: number, balls: number): string {
  return balls === 0 ? "0.00" : (runs / (balls / 6)).toFixed(2);
}

export function requiredRate(target: number, runs: number, ballsLeft: number): string {
  if (ballsLeft <= 0) return "—";
  return (((target - runs) / ballsLeft) * 6).toFixed(2);
}

export function yetToBat(state: InningsState, battingOrderIds: string[]): string[] {
  const seen = new Set(state.battedIds);
  return battingOrderIds.filter((id) => !seen.has(id));
}

export function battingCardRows(state: InningsState) {
  return [...state.batters].sort((a, b) => a.order - b.order);
}

export function bowlingCardRows(state: InningsState): BowlerCard[] {
  return state.bowlers;
}
