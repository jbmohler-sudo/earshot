-- Measuring the Phase 1 gate: 10 friends connected and coming back on their own.
-- Two minimal day-level logs (dates only, one row per user per day) and an admin view.
-- Nothing here is readable by clients.

-- One row per user per UTC day on which the poller saw them listening. Filled by trigger.
create table public.listening_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

-- One row per user per UTC day on which they opened the world.
create table public.world_visits (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  visited_on date not null,
  primary key (user_id, visited_on)
);

alter table public.listening_days enable row level security;
alter table public.world_visits   enable row level security;
revoke all on public.listening_days, public.world_visits from anon, authenticated;
grant all on public.listening_days, public.world_visits to service_role;

-- Every engagement write (new track or still playing) marks that day as a listening day.
create function private.record_listening_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.listening_days (user_id, day)
  values (new.user_id, (new.last_seen_at at time zone 'utc')::date)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.record_listening_day() from public, anon, authenticated;

create trigger on_engagement_seen
  after insert or update of last_seen_at on public.engagements
  for each row execute function private.record_listening_day();

-- Backfill from whatever is engaged right now.
insert into public.listening_days (user_id, day)
select user_id, (last_seen_at at time zone 'utc')::date from public.engagements
on conflict do nothing;

-- Signed-in users record their own world visit (at most one row per day). Takes no arguments,
-- so it can only ever write the caller's own row.
create function public.record_world_visit()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.world_visits (user_id, visited_on)
  select auth.uid(), (now() at time zone 'utc')::date
  where auth.uid() is not null
  on conflict do nothing;
$$;
revoke all on function public.record_world_visit() from public, anon;
grant execute on function public.record_world_visit() to authenticated;

-- The gate, per user. Run in the dashboard SQL editor:  select * from private.phase1_gate;
-- Lives in the private schema, which the Data API doesn't serve.
create view private.phase1_gate
with (security_invoker = true)
as
select
  p.display_name,
  u.email,
  p.created_at::date                                                                   as joined,
  exists (select 1 from public.source_accounts sa where sa.user_id = p.id)              as lastfm_connected,
  (select count(*) from public.listening_days ld
    where ld.user_id = p.id and ld.day >= (now() at time zone 'utc')::date - 13)::int    as listening_days_14,
  (select count(*) from public.world_visits wv
    where wv.user_id = p.id and wv.visited_on >= (now() at time zone 'utc')::date - 13)::int as world_days_14,
  (select max(wv.visited_on) from public.world_visits wv where wv.user_id = p.id)       as last_world_visit
from public.profiles p
join auth.users u on u.id = p.id
order by listening_days_14 desc, last_world_visit desc nulls last, joined;

revoke all on private.phase1_gate from public, anon, authenticated;
