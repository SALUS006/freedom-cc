alter table members add column if not exists has_avatar boolean not null default false;

create table if not exists member_avatars (
  member_id     uuid primary key references members(id) on delete cascade,
  data          bytea not null,
  content_type  text not null,
  updated_at    timestamptz not null default now()
);

create table if not exists password_resets (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  token_hash  text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists password_resets_token_idx on password_resets (token_hash);
create index if not exists password_resets_member_idx on password_resets (member_id, created_at desc);
