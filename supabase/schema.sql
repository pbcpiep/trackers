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

-- ---------------------------------------------------------------------------
-- Daily email digest access, without giving the server the database's master key.
-- The digest function on Vercel calls digest_rows() with a long shared secret
-- (the same value as Vercel's CRON_SECRET). The secret lives in a private
-- schema that the public API cannot read. Set it once with:
--   insert into private.app_secrets (name, value) values ('digest', '<CRON_SECRET>')
--   on conflict (name) do update set value = excluded.value;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  name  text primary key,
  value text not null
);
alter table private.app_secrets enable row level security;

create or replace function public.digest_rows(p_secret text)
returns table (user_id uuid, email text, data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or length(p_secret) < 32 or not exists (
    select 1 from private.app_secrets s where s.name = 'digest' and s.value = p_secret
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select us.user_id, u.email::text, us.data
    from public.user_state us
    join auth.users u on u.id = us.user_id;
end;
$$;

revoke all on function public.digest_rows(text) from public;
-- Only the server (anon key + secret) calls this; signed-in app users don't need it.
grant execute on function public.digest_rows(text) to anon;
