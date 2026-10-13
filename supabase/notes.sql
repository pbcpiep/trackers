-- Apple Notes sync (see docs/apple-notes-shortcut.md).
-- An iPhone Shortcut uploads the notes in chosen folders by calling
-- import_notes() with the user's personal notes key. Only a SHA-256 hash of
-- the key is stored. The app reads notes back with row-level security.

create table if not exists public.notes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  folder      text not null,
  title       text not null,
  body        text not null default '',
  modified_at timestamptz,
  synced_at   timestamptz not null default now(),
  primary key (user_id, folder, title)
);
alter table public.notes enable row level security;

drop policy if exists "Users read their own notes" on public.notes;
create policy "Users read their own notes" on public.notes
  for select using ((select auth.uid()) = user_id);

create table if not exists private.note_keys (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  key_hash   text not null unique,
  created_at timestamptz not null default now()
);
alter table private.note_keys enable row level security;

-- Called by the signed-in app ("Create my Notes key"); replaces any old key.
create or replace function public.set_notes_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  insert into private.note_keys (user_id, key_hash)
  values ((select auth.uid()), encode(extensions.digest(p_key, 'sha256'), 'hex'))
  on conflict (user_id) do update set key_hash = excluded.key_hash, created_at = now();
end;
$$;
revoke all on function public.set_notes_key(text) from public;
grant execute on function public.set_notes_key(text) to authenticated;

-- Called by the iPhone Shortcut. Replaces everything stored for that folder.
-- p_notes may be a JSON array of {title, body, modified}, a single object, or
-- text holding JSON / one JSON object per line (what Shortcuts produces when a
-- list of dictionaries is put in a text field).
create or replace function public.import_notes(p_key text, p_folder text, p_notes jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid;
  v_folder text := trim(coalesce(p_folder, ''));
  v_text   text;
  v_mod    timestamptz;
  v_count  integer := 0;
  n        jsonb;
begin
  if p_key is null or length(p_key) < 32 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select k.user_id into v_user
  from private.note_keys k
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex');
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_folder = '' or length(v_folder) > 100 then
    raise exception 'folder name required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_notes) = 'string' then
    v_text := p_notes #>> '{}';
    begin
      p_notes := v_text::jsonb;
    exception when others then
      select coalesce(jsonb_agg(line::jsonb), '[]'::jsonb) into p_notes
      from regexp_split_to_table(v_text, E'\n') as line
      where trim(line) <> '';
    end;
  end if;
  if jsonb_typeof(p_notes) = 'object' then p_notes := jsonb_build_array(p_notes); end if;
  if p_notes is null or jsonb_typeof(p_notes) <> 'array' or jsonb_array_length(p_notes) > 1000 then
    raise exception 'notes must be a list (at most 1000)' using errcode = '22023';
  end if;

  delete from public.notes where user_id = v_user and folder = v_folder;
  for n in select * from jsonb_array_elements(p_notes) loop
    continue when jsonb_typeof(n) <> 'object' or coalesce(trim(n ->> 'title'), '') = '';
    begin
      v_mod := (n ->> 'modified')::timestamptz;
    exception when others then
      v_mod := null;
    end;
    insert into public.notes (user_id, folder, title, body, modified_at)
    values (v_user, v_folder, left(trim(n ->> 'title'), 300), left(coalesce(n ->> 'body', ''), 100000), v_mod)
    on conflict (user_id, folder, title)
      do update set body = excluded.body, modified_at = excluded.modified_at, synced_at = now();
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.import_notes(text, text, jsonb) from public;
grant execute on function public.import_notes(text, text, jsonb) to anon;
