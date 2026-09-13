-- Sloka Adventure Engine v1.0
-- Adds server-side recital counting while preserving existing daily practice events.

create table if not exists public.recital_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  series_key text not null,
  week_number integer not null check (week_number between 1 and 100),
  practice_date date not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  unique(player_id, series_key, week_number, event_id)
);

create index if not exists idx_recital_events_day
  on public.recital_events(player_id, series_key, week_number, practice_date);

alter table public.recital_events enable row level security;
revoke all on public.recital_events from anon, authenticated;
