-- Step 5: adaptive Last.fm poller + genre mapper cache.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Poll scheduling on source_accounts
-- ---------------------------------------------------------------------------
alter table public.source_accounts
  add column next_poll_at timestamptz not null default now(),
  add column last_error   text;
create index source_accounts_due_idx on public.source_accounts (source, next_poll_at);

-- ---------------------------------------------------------------------------
-- Genre mapper cache: keep the display name and tags so the 30-day refresh
-- and engagements.tags don't need another Last.fm call.
-- ---------------------------------------------------------------------------
alter table public.artist_zones
  add column artist_name text,
  add column tags        text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Lease due accounts. Concurrent runs skip rows another run has locked, and the lease
-- (next_poll_at pushed out) stops a crashed run from leaving accounts claimed forever.
-- Returns the username and the current engagement, never the session key.
-- ---------------------------------------------------------------------------
create function public.claim_due_accounts(p_source text, p_limit int, p_lease_seconds int)
returns table (
  user_id           uuid,
  external_username text,
  last_changed_at   timestamptz,
  item_key          text,
  last_seen_at      timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  with due as (
    select sa.user_id
    from public.source_accounts sa
    where sa.source = p_source and sa.next_poll_at <= now()
    order by sa.next_poll_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.source_accounts sa
    set next_poll_at = now() + make_interval(secs => p_lease_seconds)
    from due
    where sa.user_id = due.user_id and sa.source = p_source
    returning sa.user_id, sa.external_username, sa.last_changed_at
  )
  select l.user_id, l.external_username, l.last_changed_at, e.item_key, e.last_seen_at
  from leased l
  left join public.engagements e on e.user_id = l.user_id and e.source = p_source;
$$;
revoke all on function public.claim_due_accounts(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_due_accounts(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- One-time helper so a local script can put the poller URL + shared secret into Vault
-- without the value ever appearing in a migration (migration statements are stored).
-- Dropped again by the cron migration.
-- ---------------------------------------------------------------------------
create function public.earshot_set_vault_secret(p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  if p_name not in ('earshot_poller_url', 'earshot_poller_secret') then
    raise exception 'unexpected secret name %', p_name;
  end if;
  select id into existing from vault.secrets where name = p_name;
  if existing is null then
    perform vault.create_secret(p_secret, p_name);
  else
    perform vault.update_secret(existing, p_secret);
  end if;
end;
$$;
revoke all on function public.earshot_set_vault_secret(text, text) from public, anon, authenticated;
grant execute on function public.earshot_set_vault_secret(text, text) to service_role;
