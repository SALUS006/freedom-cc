-- Per-player, per-match performance stats + points, and the computed
-- (or admin-overridden) Player of the Match.

create table if not exists player_match_stats (
  member_id      uuid not null references members(id) on delete cascade,
  match_id       uuid not null references matches(id) on delete cascade,
  side           text not null,                 -- a | b
  batted         boolean not null default false,
  runs           int not null default 0,
  balls          int not null default 0,
  fours          int not null default 0,
  sixes          int not null default 0,
  how_out        text,                          -- wicket type | not_out | retired_not_out | null
  bowled         boolean not null default false,
  legal_balls    int not null default 0,
  runs_conceded  int not null default 0,
  wickets        int not null default 0,
  maidens        int not null default 0,
  catches        int not null default 0,
  stumpings      int not null default 0,
  run_outs       int not null default 0,
  -- double precision (not numeric): the pg driver returns numeric as a string
  -- to avoid float rounding on money-like values, which we don't need here.
  bat_points     double precision not null default 0,
  bowl_points    double precision not null default 0,
  field_points   double precision not null default 0,
  result_points  double precision not null default 0,
  total_points   double precision not null default 0,
  created_at     timestamptz not null default now(),
  primary key (member_id, match_id)
);

create index if not exists player_match_stats_member_idx on player_match_stats (member_id);
create index if not exists player_match_stats_match_idx on player_match_stats (match_id);

alter table matches add column if not exists player_of_match_id uuid references members(id) on delete set null;
-- true = the algorithm's pick is showing; false = an admin overrode it.
alter table matches add column if not exists player_of_match_auto boolean not null default true;
