-- Run once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Each user's trackers are stored as one JSON document.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Users read their own state" on public.user_state;
create policy "Users read their own state" on public.user_state
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users create their own state" on public.user_state;
create policy "Users create their own state" on public.user_state
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own state" on public.user_state;
create policy "Users update their own state" on public.user_state
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
