-- Multi-user mock student table for Sloka Adventure
-- Run in Supabase SQL Editor.

create table if not exists public.mock_students (
  email text primary key,
  zenler_user_id text not null unique,
  first_name text not null,
  last_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep browser clients away from this table.
alter table public.mock_students enable row level security;
revoke all on public.mock_students from anon, authenticated;

-- Sample users. Change these to any test emails/names you want.
insert into public.mock_students
  (email, zenler_user_id, first_name, last_name, active)
values
  ('test1@example.com', 'mock-user-001', 'Aarav', null, true),
  ('test2@example.com', 'mock-user-002', 'Maya', null, true),
  ('test3@example.com', 'mock-user-003', 'Rohan', null, true)
on conflict (email) do update set
  zenler_user_id = excluded.zenler_user_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  active = excluded.active,
  updated_at = now();
