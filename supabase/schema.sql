-- Run this once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.kv (
  key   text primary key,
  value jsonb,
  at    bigint not null
);
create index if not exists kv_at_idx on public.kv (at);

-- The app talks to this table only through its own server, using the service key.
-- Turning row level security on with no policies means nobody else can read or write it from outside.
alter table public.kv enable row level security;
