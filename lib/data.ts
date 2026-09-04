import "server-only";
import { one, query } from "./db";
import { getSession } from "./session";
import type { Club, InningsRow, MatchDay, MatchRow, MatchSquadEntry, Member } from "./types";

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

export async function matchDayPlayers(dayId: string): Promise<Member[]> {
  return query<Member>(
    `select m.* from members m
       join match_day_players p on p.member_id = m.id
      where p.match_day_id = $1
      order by m.name`,
    [dayId]
  );
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
