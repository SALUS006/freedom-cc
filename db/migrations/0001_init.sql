create extension if not exists "pgcrypto";

-- one club per deployment (nothing stops several rows, but the app is single-club)
create table clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  invite_code  text unique not null,
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table members (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references clubs(id) on delete cascade,
  name              text not null,
  email             text not null,
  phone             text,
  password_hash     text not null,
  roles             text[] not null default '{}',           -- batter | bowler | keeper | allrounder
  batting_style     text,                                   -- right | left
  bowling_type      text,                                   -- pace | off-spin | leg-spin | left-arm
  bat_self          int not null default 5,
  bowl_self         int not null default 5,
  field_self        int not null default 5,
  is_keeper         boolean not null default false,
  happy_to_captain  boolean not null default false,
  is_admin          boolean not null default false,
  consent_version   text,
  consent_at        timestamptz,
  consent_ip        text,
  created_at        timestamptz not null default now()
);

create unique index members_club_email_idx on members (club_id, lower(email));

create table rating_changes (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  bat_self    int not null,
  bowl_self   int not null,
  field_self  int not null,
  changed_at  timestamptz not null default now()
);

create table match_days (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  played_on   date not null,
  ground      text,
  notes       text,
  created_by  uuid references members(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table match_day_players (
  match_day_id uuid not null references match_days(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  primary key (match_day_id, member_id)
);

create table matches (
  id                    uuid primary key default gen_random_uuid(),
  match_day_id          uuid not null references match_days(id) on delete cascade,
  seq_no                int not null default 1,
  overs                 int not null,
  players_per_side      int not null default 11,
  max_overs_per_bowler  int not null,
  rules                 jsonb not null default '{}'::jsonb,
  side_a_name           text not null default 'Side A',
  side_b_name           text not null default 'Side B',
  toss_winner           text,                       -- a | b
  elected               text,                       -- bat | field
  status                text not null default 'setup',   -- setup | live | complete | abandoned
  result                jsonb,
  created_at            timestamptz not null default now()
);

create table match_squads (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  member_id      uuid not null references members(id) on delete cascade,
  side           text not null,                     -- a | b
  batting_order  int not null default 99,
  is_captain     boolean not null default false,
  is_keeper      boolean not null default false,
  unique (match_id, member_id)
);

create table innings (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  seq            int not null,                      -- 1 | 2
  batting_side   text not null,                     -- a | b
  target         int,
  closed_reason  text,                              -- overs | all_out | target | declared
  created_at     timestamptz not null default now(),
  unique (match_id, seq)
);

-- append-only event log: the source of truth for a match.
create table match_events (
  id           uuid primary key default gen_random_uuid(),
  innings_id   uuid not null references innings(id) on delete cascade,
  seq          int not null,                        -- 1-based order within the innings
  type         text not null,                       -- openers | bowler | delivery | new_batter | swap_strike | retire | close_innings
  payload      jsonb not null default '{}'::jsonb,
  client_uuid  uuid unique,
  created_at   timestamptz not null default now(),
  unique (innings_id, seq)
);

create index match_days_club_idx on match_days (club_id, played_on desc);
create index matches_day_idx on matches (match_day_id, seq_no);
create index match_events_innings_idx on match_events (innings_id, seq);
create index match_squads_match_idx on match_squads (match_id);
