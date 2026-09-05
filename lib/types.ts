export type Side = "a" | "b";
export type Role = "batter" | "bowler" | "keeper" | "allrounder";

export interface Club {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Member {
  id: string;
  club_id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: Role[];
  batting_style: string | null;
  bowling_type: string | null;
  bat_self: number;
  bowl_self: number;
  field_self: number;
  is_keeper: boolean;
  happy_to_captain: boolean;
  is_admin: boolean;
  has_avatar: boolean;
  consent_version: string | null;
  consent_at: string | null;
  created_at: string;
}

export interface MatchDay {
  id: string;
  club_id: string;
  played_on: string;
  ground: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MatchRow {
  id: string;
  match_day_id: string;
  seq_no: number;
  overs: number;
  players_per_side: number;
  max_overs_per_bowler: number;
  rules: MatchRules;
  side_a_name: string;
  side_b_name: string;
  toss_winner: Side | null;
  elected: "bat" | "field" | null;
  status: "setup" | "live" | "complete" | "abandoned";
  result: MatchResult | null;
  player_of_match_id: string | null;
  player_of_match_auto: boolean;
  created_at: string;
}

export interface MatchRules {
  wideNoballPenalty: number;
  freeHitOnNoball: boolean;
  byesEnabled: boolean;
  lastManStands: boolean;
}

export const DEFAULT_RULES: MatchRules = {
  wideNoballPenalty: 1,
  freeHitOnNoball: true,
  byesEnabled: true,
  lastManStands: false,
};

export interface MatchSquadEntry {
  id: string;
  match_id: string;
  member_id: string;
  side: Side;
  batting_order: number;
  is_captain: boolean;
  is_keeper: boolean;
  name?: string;
}

export interface InningsRow {
  id: string;
  match_id: string;
  seq: number;
  batting_side: Side;
  target: number | null;
  closed_reason: string | null;
  created_at: string;
}

export interface MatchResult {
  winner: Side | null;
  tie: boolean;
  summary: string;
}
