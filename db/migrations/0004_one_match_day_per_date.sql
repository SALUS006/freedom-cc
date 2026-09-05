-- One match day per club per calendar date. Consolidate any duplicates that
-- already exist (created before this constraint) into the earliest one before
-- enforcing uniqueness, so existing data doesn't block the migration.
do $$
declare
  grp record;
  keep_id uuid;
  m record;
  next_seq int;
begin
  for grp in
    select club_id, played_on
      from match_days
     group by club_id, played_on
    having count(*) > 1
  loop
    select id into keep_id
      from match_days
     where club_id = grp.club_id and played_on = grp.played_on
     order by created_at asc
     limit 1;

    select coalesce(max(seq_no), 0) into next_seq
      from matches where match_day_id = keep_id;

    for m in
      select id from matches
       where match_day_id in (
         select id from match_days
          where club_id = grp.club_id and played_on = grp.played_on and id <> keep_id
       )
       order by created_at
    loop
      next_seq := next_seq + 1;
      update matches set match_day_id = keep_id, seq_no = next_seq where id = m.id;
    end loop;

    insert into match_day_players (match_day_id, member_id)
    select keep_id, member_id
      from match_day_players
     where match_day_id in (
        select id from match_days
         where club_id = grp.club_id and played_on = grp.played_on and id <> keep_id
     )
    on conflict do nothing;

    delete from match_days
     where club_id = grp.club_id and played_on = grp.played_on and id <> keep_id;
  end loop;
end $$;

alter table match_days
  add constraint match_days_club_date_unique unique (club_id, played_on);
