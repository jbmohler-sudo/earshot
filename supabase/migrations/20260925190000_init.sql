-- Earshot Phase 1 schema.
-- "Automatically expose new tables" is OFF on this project, so every client-facing
-- privilege is granted explicitly below. source_accounts gets no client grants at all.

-- ---------------------------------------------------------------------------
-- profiles: one per auth user, created by trigger on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 24),
  avatar       jsonb not null default '{}'::jsonb
               check (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 1024),
  visible      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- source_accounts: linked Last.fm accounts. Holds session_key; server only.
-- ---------------------------------------------------------------------------
create table public.source_accounts (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  source            text not null,
  external_username text not null,
  session_key       text not null,
  last_polled_at    timestamptz,
  last_changed_at   timestamptz,
  primary key (user_id, source),
  unique (source, external_username)
);

-- ---------------------------------------------------------------------------
-- engagements: what each person is playing right now (one row per person)
-- ---------------------------------------------------------------------------
create table public.engagements (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  source       text not null,
  item_key     text not null,
  title        text not null,
  artist       text not null,
  tags         text[] not null default '{}',
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- artist_zones: genre-mapper cache (server only)
-- ---------------------------------------------------------------------------
create table public.artist_zones (
  artist_key text primary key,
  zone_id    text not null,
  confidence real not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- presence: who stands where. Venue tier is derived from counts, never stored.
-- ---------------------------------------------------------------------------
create table public.presence (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  zone_id    text not null,
  artist_key text not null,
  spot       text not null check (spot in ('stage', 'field', 'plaza')),
  updated_at timestamptz not null default now()
);
create index presence_zone_idx on public.presence (zone_id);

-- ---------------------------------------------------------------------------
-- RLS on everything
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.source_accounts enable row level security;
alter table public.engagements     enable row level security;
alter table public.artist_zones    enable row level security;
alter table public.presence        enable row level security;

-- Is this person visible in the world? Security definer so policies on other
-- tables can check it without granting anything extra.
create function public.is_visible(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.visible from public.profiles p where p.id = uid), false);
$$;

-- profiles: anyone can see visible people; you can always see and edit yourself.
create policy "profiles: read visible or own"
  on public.profiles for select
  to anon, authenticated
  using (visible or id = (select auth.uid()));

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- engagements / presence: readable only for visible people. Writes are server-only.
create policy "engagements: read visible"
  on public.engagements for select
  to anon, authenticated
  using (public.is_visible(user_id));

create policy "presence: read visible"
  on public.presence for select
  to anon, authenticated
  using (public.is_visible(user_id));

-- source_accounts and artist_zones: no policies, no client grants. service_role bypasses RLS.

-- ---------------------------------------------------------------------------
-- Grants (explicit; nothing is exposed by default on this project)
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.source_accounts, public.engagements,
              public.artist_zones, public.presence
  from anon, authenticated;

grant select on public.profiles    to anon, authenticated;
grant update (display_name, avatar, visible) on public.profiles to authenticated;
grant select on public.engagements to anon, authenticated;
grant select on public.presence    to anon, authenticated;

grant all on public.profiles, public.source_accounts, public.engagements,
             public.artist_zones, public.presence
  to service_role;

revoke all on function public.is_visible(uuid) from public;
grant execute on function public.is_visible(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- New auth user -> profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hide toggle: turning visible off removes you from the world immediately.
create function public.handle_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visible = false and old.visible = true then
    delete from public.presence where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_hide() from public, anon, authenticated;

create trigger on_profile_hidden
  after update of visible on public.profiles
  for each row execute function public.handle_hide();

-- ---------------------------------------------------------------------------
-- Realtime: clients subscribe to presence changes per zone.
-- ---------------------------------------------------------------------------
alter table public.presence replica identity full;
alter publication supabase_realtime add table public.presence;
