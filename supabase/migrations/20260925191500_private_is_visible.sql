-- Move is_visible() out of the exposed public schema so it isn't callable as /rest/v1/rpc/is_visible.
-- RLS policies still need to execute it as anon/authenticated, hence the usage + execute grants.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create function private.is_visible(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.visible from public.profiles p where p.id = uid), false);
$$;
revoke all on function private.is_visible(uuid) from public;
grant execute on function private.is_visible(uuid) to anon, authenticated, service_role;

drop policy "engagements: read visible" on public.engagements;
create policy "engagements: read visible"
  on public.engagements for select
  to anon, authenticated
  using (private.is_visible(user_id));

drop policy "presence: read visible" on public.presence;
create policy "presence: read visible"
  on public.presence for select
  to anon, authenticated
  using (private.is_visible(user_id));

drop function public.is_visible(uuid);
