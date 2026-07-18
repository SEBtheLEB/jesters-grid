-- Jester's Grid authoritative multiplayer room store.
-- Run this once in the Supabase SQL editor, then configure the server-only
-- SUPABASE_URL and SUPABASE_SECRET_KEY environment variables in Vercel.

create table if not exists public.jesters_grid_rooms (
  code text primary key check (code ~ '^[A-Z2-9]{5}$'),
  state jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '6 hours')
);

create index if not exists jesters_grid_rooms_expires_at_idx
  on public.jesters_grid_rooms (expires_at);

alter table public.jesters_grid_rooms enable row level security;

-- The browser never talks to this table. Only the server-side service role can
-- read or mutate complete game state, including hidden hands and decks.
revoke all on table public.jesters_grid_rooms from anon, authenticated;
grant select, insert, update, delete on table public.jesters_grid_rooms to service_role;

create or replace function public.cleanup_expired_jesters_grid_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.jesters_grid_rooms where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_expired_jesters_grid_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_expired_jesters_grid_rooms() to service_role;
