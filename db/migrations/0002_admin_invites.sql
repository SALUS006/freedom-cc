alter table members add column if not exists password_reset_required boolean not null default false;
alter table members add column if not exists invited_by uuid references members(id) on delete set null;

create table if not exists email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  subject     text not null,
  body        text not null,
  status      text not null default 'pending',   -- pending | sent | logged | failed
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index if not exists email_outbox_created_idx on email_outbox (created_at desc);
