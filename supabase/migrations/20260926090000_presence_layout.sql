-- Step 7: server-side layout. The poller runs the core World per zone after each cycle and
-- writes presence; clients subscribe to presence for their zone and only animate.

-- Presence carries everything a viewer needs, so one realtime table drives the world.
-- (The same fields are already readable for visible people via profiles/engagements.)
alter table public.presence
  add column slot         int check (slot >= 0),
  add column spot_index   int check (spot_index >= 0),
  add column item_key     text not null default '',
  add column artist_name  text not null default '',
  add column title        text not null default '',
  add column display_name text,
  add column avatar       jsonb not null default '{}'::jsonb,
  add constraint presence_plaza_has_no_slot check ((spot = 'plaza') = (slot is null) and (slot is null) = (spot_index is null));

-- The poller now records the normalized artist key alongside the display name.
alter table public.engagements add column artist_key text;
update public.engagements set artist_key = lower(regexp_replace(btrim(artist), '\s+', ' ', 'g')) where artist_key is null;

-- Per-zone layout history (slot owners, stage items, spot indices), so hysteresis survives restarts.
-- Server only: RLS on, no client grants.
create table public.zone_state (
  zone_id    text primary key,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.zone_state enable row level security;
revoke all on public.zone_state from anon, authenticated;
grant all on public.zone_state to service_role;
