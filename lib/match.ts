import "server-only";
import { query } from "./db";
import { deriveResult, reduceInnings, type MatchOutcome } from "./scoring/engine";
import type { InningsState, MatchEvent, ScoringConfig } from "./scoring/types";
import { DEFAULT_RULES, type InningsRow, type MatchRow, type MatchSquadEntry, type Side } from "./types";

export function scoringConfig(match: MatchRow): ScoringConfig {
  const rules = { ...DEFAULT_RULES, ...(match.rules ?? {}) };
  return {
    overs: match.overs,
    playersPerSide: match.players_per_side,
    wideNoballPenalty: rules.wideNoballPenalty,
    freeHitOnNoball: rules.freeHitOnNoball,
    lastManStands: rules.lastManStands,
    maxOversPerBowler: match.max_overs_per_bowler,
  };
}

export function battingSideFor(match: MatchRow, seq: number): Side {
  const first: Side =
    match.elected === "bat"
      ? (match.toss_winner as Side)
      : match.toss_winner === "a"
        ? "b"
        : "a";
  if (seq === 1) return first;
  return first === "a" ? "b" : "a";
}

export interface InningsView {
  row: InningsRow;
  events: MatchEvent[];
  state: InningsState;
  battingSide: Side;
  battingName: string;
  bowlingName: string;
}

export interface MatchBundle {
  match: MatchRow;
  squad: MatchSquadEntry[];
  names: Record<string, string>;
  config: ScoringConfig;
  innings: InningsView[];
  result: MatchOutcome | null;
}

export async function loadMatchBundle(matchId: string): Promise<MatchBundle | null> {
  const [match] = await query<MatchRow>(`select * from matches where id = $1`, [matchId]);
  if (!match) return null;

  const squad = await query<MatchSquadEntry>(
    `select s.*, m.name from match_squads s join members m on m.id = s.member_id
      where s.match_id = $1 order by s.side, s.batting_order`,
    [matchId]
  );
  const names: Record<string, string> = {};
  for (const s of squad) names[s.member_id] = s.name ?? "?";

  const config = scoringConfig(match);
  const inningsRows = await query<InningsRow>(
    `select * from innings where match_id = $1 order by seq`,
    [matchId]
  );

  const innings: InningsView[] = [];
  for (const row of inningsRows) {
    const evRows = await query<{ type: string; payload: Record<string, unknown> }>(
      `select type, payload from match_events where innings_id = $1 order by seq`,
      [row.id]
    );
    const events = evRows.map((e) => ({ type: e.type, ...(e.payload as object) })) as MatchEvent[];
    const state = reduceInnings(events, config, row.target);
    const battingSide = row.batting_side;
    innings.push({
      row,
      events,
      state,
      battingSide,
      battingName: battingSide === "a" ? match.side_a_name : match.side_b_name,
      bowlingName: battingSide === "a" ? match.side_b_name : match.side_a_name,
    });
  }

  let result: MatchOutcome | null = null;
  if (innings.length === 2 && innings[1].state.closed) {
    result = deriveResult(
      config,
      { side: innings[0].battingSide, state: innings[0].state, name: innings[0].battingName },
      { side: innings[1].battingSide, state: innings[1].state, name: innings[1].battingName }
    );
  }

  return { match, squad, names, config, innings, result };
}

export interface DayCard {
  match: MatchRow;
  lines: { side: Side; name: string; runs: number; wickets: number; overs: string; batted: boolean }[];
  status: MatchRow["status"];
  summary: string | null;
}

async function buildCard(match: MatchRow): Promise<DayCard> {
  const lines: DayCard["lines"] = [];
  if (match.status === "live" || match.status === "complete") {
    const bundle = await loadMatchBundle(match.id);
    if (bundle) {
      for (const inn of bundle.innings) {
        lines.push({
          side: inn.battingSide,
          name: inn.battingName,
          runs: inn.state.runs,
          wickets: inn.state.wickets,
          overs: inn.state.oversLabel,
          batted: true,
        });
      }
      const batted = new Set(lines.map((l) => l.side));
      for (const side of ["a", "b"] as Side[]) {
        if (!batted.has(side)) {
          lines.push({
            side,
            name: side === "a" ? match.side_a_name : match.side_b_name,
            runs: 0,
            wickets: 0,
            overs: "0.0",
            batted: false,
          });
        }
      }
      lines.sort((x, y) => (x.batted === y.batted ? 0 : x.batted ? -1 : 1));
    }
  } else {
    lines.push(
      { side: "a", name: match.side_a_name, runs: 0, wickets: 0, overs: "0.0", batted: false },
      { side: "b", name: match.side_b_name, runs: 0, wickets: 0, overs: "0.0", batted: false }
    );
  }
  return { match, lines, status: match.status, summary: match.result?.summary ?? null };
}

/** Compact per-match rows for the match-day screen. */
export async function loadDayCards(dayId: string): Promise<DayCard[]> {
  const matches = await query<MatchRow>(
    `select * from matches where match_day_id = $1 order by seq_no`,
    [dayId]
  );
  return Promise.all(matches.map(buildCard));
}

/** Live matches across the whole club — for the Home "Live now" strip. */
export async function loadLiveCards(clubId: string): Promise<DayCard[]> {
  const matches = await query<MatchRow>(
    `select m.* from matches m
       join match_days d on d.id = m.match_day_id
      where d.club_id = $1 and m.status = 'live'
      order by d.played_on desc, m.seq_no`,
    [clubId]
  );
  return Promise.all(matches.map(buildCard));
}
