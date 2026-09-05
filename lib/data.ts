import "server-only";
import { one, query, tx } from "./db";
import { getSession } from "./session";
import type { Club, InningsRow, MatchDay, MatchRow, MatchSquadEntry, Member, Side } from "./types";
import type { PlayerMatchStat } from "./scoring/points";

export async function currentMember(): Promise<Member | null> {
  const session = await getSession();
  if (!session) return null;
  return one<Member>(`select * from members where id = $1`, [session.memberId]);
}

export async function currentClub(): Promise<Club | null> {
  const session = await getSession();
  if (!session) return null;
  return one<Club>(`select * from clubs where id = $1`, [session.clubId]);
}

export async function listMembers(clubId: string): Promise<Member[]> {
  return query<Member>(`select * from members where club_id = $1 order by name`, [clubId]);
}

export interface AdminMember {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  has_avatar: boolean;
  consent_at: string | null;
  password_reset_required: boolean;
  created_at: string;
}

export async function adminMembers(clubId: string): Promise<AdminMember[]> {
  return query<AdminMember>(
    `select id, name, email, is_admin, has_avatar, consent_at, password_reset_required, created_at
       from members where club_id = $1
      order by is_admin desc, (consent_at is null), name`,
    [clubId]
  );
}

export async function adminMember(id: string, clubId: string): Promise<AdminMember | null> {
  return one<AdminMember>(
    `select id, name, email, is_admin, has_avatar, consent_at, password_reset_required, created_at
       from members where id = $1 and club_id = $2`,
    [id, clubId]
  );
}

export async function memberMatchCount(memberId: string): Promise<number> {
  const row = await one<{ n: string }>(
    `select count(distinct match_id)::text as n from match_squads where member_id = $1`,
    [memberId]
  );
  return row ? Number(row.n) : 0;
}

export async function listMatchDays(clubId: string): Promise<(MatchDay & { matches: number })[]> {
  return query(
    `select d.*, count(m.id)::int as matches
       from match_days d
       left join matches m on m.match_day_id = d.id
      where d.club_id = $1
      group by d.id
      order by d.played_on desc, d.created_at desc`,
    [clubId]
  );
}

export async function getMatchDay(id: string, clubId: string): Promise<MatchDay | null> {
  return one<MatchDay>(`select * from match_days where id = $1 and club_id = $2`, [id, clubId]);
}

/** One match day per club per calendar date — find the existing one, if any. */
export async function findMatchDayByDate(clubId: string, playedOn: string): Promise<MatchDay | null> {
  return one<MatchDay>(`select * from match_days where club_id = $1 and played_on = $2`, [
    clubId,
    playedOn,
  ]);
}

export async function matchDayPlayers(dayId: string): Promise<Member[]> {
  return query<Member>(
    `select m.* from members m
       join match_day_players p on p.member_id = m.id
      where p.match_day_id = $1
      order by m.name`,
    [dayId]
  );
}

export async function memberCount(clubId: string): Promise<number> {
  const row = await one<{ n: string }>(`select count(*)::text as n from members where club_id = $1`, [
    clubId,
  ]);
  return row ? Number(row.n) : 0;
}

/** Members already placed in a squad for a match on this day — turnout can't drop them. */
export async function matchDayLockedPlayerIds(dayId: string): Promise<string[]> {
  const rows = await query<{ member_id: string }>(
    `select distinct s.member_id
       from match_squads s
       join matches m on m.id = s.match_id
      where m.match_day_id = $1`,
    [dayId]
  );
  return rows.map((r) => r.member_id);
}

/**
 * Replaces a match day's turnout with `playerIds` (restricted to club members).
 * Anyone already in a squad for a match that day is kept regardless, so an
 * existing match's lineup never breaks.
 */
export async function setMatchDayTurnout(
  dayId: string,
  clubId: string,
  playerIds: string[]
): Promise<void> {
  const locked = await matchDayLockedPlayerIds(dayId);
  const keep = new Set([...playerIds, ...locked]);
  await query(
    `delete from match_day_players
      where match_day_id = $1 and member_id <> all($2::uuid[])`,
    [dayId, [...keep]]
  );
  for (const id of keep) {
    await query(
      `insert into match_day_players (match_day_id, member_id)
       select $1, $2 where exists (select 1 from members where id = $2 and club_id = $3)
       on conflict do nothing`,
      [dayId, id, clubId]
    );
  }
}

export async function matchesForDay(dayId: string): Promise<MatchRow[]> {
  return query<MatchRow>(
    `select * from matches where match_day_id = $1 order by seq_no`,
    [dayId]
  );
}

export async function getMatch(id: string): Promise<MatchRow | null> {
  return one<MatchRow>(`select * from matches where id = $1`, [id]);
}

export async function matchSquad(matchId: string): Promise<MatchSquadEntry[]> {
  return query<MatchSquadEntry>(
    `select s.*, m.name
       from match_squads s
       join members m on m.id = s.member_id
      where s.match_id = $1
      order by s.side, s.batting_order`,
    [matchId]
  );
}

export async function matchInnings(matchId: string): Promise<InningsRow[]> {
  return query<InningsRow>(`select * from innings where match_id = $1 order by seq`, [matchId]);
}

export async function inningsEvents(inningsId: string) {
  return query<{ seq: number; type: string; payload: Record<string, unknown> }>(
    `select seq, type, payload from match_events where innings_id = $1 order by seq`,
    [inningsId]
  );
}

// ---------- performance stats & Man of the Match ----------

export async function savePlayerMatchStats(matchId: string, stats: PlayerMatchStat[]): Promise<void> {
  await tx(async (client) => {
    await client.query(`delete from player_match_stats where match_id = $1`, [matchId]);
    for (const s of stats) {
      await client.query(
        `insert into player_match_stats (
           member_id, match_id, side, batted, runs, balls, fours, sixes, how_out,
           bowled, legal_balls, runs_conceded, wickets, maidens,
           catches, stumpings, run_outs,
           bat_points, bowl_points, field_points, result_points, total_points
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          s.memberId,
          matchId,
          s.side,
          s.batted,
          s.runs,
          s.balls,
          s.fours,
          s.sixes,
          s.howOut,
          s.bowled,
          s.legalBalls,
          s.runsConceded,
          s.wickets,
          s.maidens,
          s.catches,
          s.stumpings,
          s.runOuts,
          s.batPoints,
          s.bowlPoints,
          s.fieldPoints,
          s.resultPoints,
          s.totalPoints,
        ]
      );
    }
  });
}

export async function setPlayerOfMatch(
  matchId: string,
  memberId: string | null,
  auto: boolean
): Promise<void> {
  await query(
    `update matches set player_of_match_id = $2, player_of_match_auto = $3 where id = $1`,
    [matchId, memberId, auto]
  );
}

export interface MatchStatRow {
  member_id: string;
  name: string;
  side: Side;
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  how_out: string | null;
  bowled: boolean;
  legal_balls: number;
  runs_conceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  stumpings: number;
  run_outs: number;
  bat_points: number;
  bowl_points: number;
  field_points: number;
  result_points: number;
  total_points: number;
}

export async function matchStatsFor(matchId: string): Promise<MatchStatRow[]> {
  return query<MatchStatRow>(
    `select s.*, m.name
       from player_match_stats s
       join members m on m.id = s.member_id
      where s.match_id = $1
      order by s.total_points desc`,
    [matchId]
  );
}

export interface ClubStatRow {
  member_id: string;
  batted: boolean;
  bowled: boolean;
  bat_points: number;
  bowl_points: number;
  field_points: number;
}

/** Every performance row for a club, across all completed matches — for earned ratings. */
export async function matchStatsForClub(clubId: string): Promise<ClubStatRow[]> {
  return query<ClubStatRow>(
    `select s.member_id, s.batted, s.bowled, s.bat_points, s.bowl_points, s.field_points
       from player_match_stats s
       join matches ma on ma.id = s.match_id
       join match_days d on d.id = ma.match_day_id
      where d.club_id = $1`,
    [clubId]
  );
}

export async function motmCounts(clubId: string): Promise<Map<string, number>> {
  const rows = await query<{ player_of_match_id: string; n: string }>(
    `select ma.player_of_match_id, count(*)::text as n
       from matches ma
       join match_days d on d.id = ma.match_day_id
      where d.club_id = $1 and ma.player_of_match_id is not null
      group by ma.player_of_match_id`,
    [clubId]
  );
  return new Map(rows.map((r) => [r.player_of_match_id, Number(r.n)]));
}
