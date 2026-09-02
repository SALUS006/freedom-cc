export type ExtraType = "wide" | "noball" | "bye" | "legbye";

export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "stumped"
  | "run_out"
  | "hit_wicket"
  | "obstructing"
  | "retired_out";

export const BOWLER_WICKETS: WicketType[] = ["bowled", "caught", "lbw", "stumped", "hit_wicket"];

export interface ScoringConfig {
  overs: number;
  playersPerSide: number;
  wideNoballPenalty: number;
  freeHitOnNoball: boolean;
  lastManStands: boolean;
  /** 0 / undefined = no limit. A bowler at the cap can't be given a new over. */
  maxOversPerBowler?: number;
}

export interface DeliveryPayload {
  runsBat: number;
  extra?: ExtraType;
  /** wide: byes run off it; bye/legbye: runs taken; noball: byes run off it */
  extraRuns?: number;
  wicket?: {
    type: WicketType;
    who: "striker" | "non_striker";
    crossed?: boolean;
    fielderId?: string | null;
  };
}

export type MatchEvent =
  | { type: "openers"; strikerId: string; nonStrikerId: string }
  | { type: "bowler"; bowlerId: string }
  | { type: "delivery"; payload: DeliveryPayload }
  | { type: "new_batter"; batterId: string }
  | { type: "swap_strike" }
  | { type: "retire"; batterId: string; out: boolean }
  | { type: "close_innings"; reason: string };

export interface BatterCard {
  id: string;
  order: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: WicketType | null;
  outBowlerId: string | null;
  outFielderId: string | null;
  onCrease: boolean;
  retiredNotOut: boolean;
}

export interface BowlerCard {
  id: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noballs: number;
  dots: number;
}

export interface TimelineBall {
  over: number;
  legalBall: number | null;
  label: string;
  runs: number;
  wicket: boolean;
  extra: ExtraType | null;
}

export interface FallOfWicket {
  wicket: number;
  runs: number;
  batterId: string;
  over: string;
}

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number;
  completedOvers: number;
  ballInOver: number;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  previousBowlerId: string | null;
  needOpeners: boolean;
  needNewBatter: boolean;
  needNewBowler: boolean;
  freeHit: boolean;
  extras: { b: number; lb: number; w: number; nb: number; total: number };
  batters: BatterCard[];
  bowlers: BowlerCard[];
  fallOfWickets: FallOfWicket[];
  timeline: TimelineBall[];
  partnershipRuns: number;
  partnershipBalls: number;
  target: number | null;
  closed: string | null;
  battedIds: string[];
  oversLabel: string;
}
