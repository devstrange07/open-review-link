-- ===========================================================================
-- 0002_rls.sql — Row Level Security
--
-- Threat model: the anon key is public (it ships in the browser bundle). A
-- customer must not be able to read other customers' feedback, read analytics,
-- or change shop settings by talking to Supabase directly.
--
-- Design: no INSERT policy exists on any table. All writes happen in route
-- handlers using the service-role client, which bypasses RLS. So even a
-- compromised browser session can read nothing it shouldn't and write nothing
-- at all, regardless of what our API allows.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Admin predicate
--
-- SECURITY DEFINER so it can read admin_users without the caller needing a
-- policy on admin_users. `search_path` is pinned so a caller cannot shadow
-- `admin_users` with an object in a schema they control.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

comment on function public.is_admin() is
  'True when the current JWT belongs to an allowlisted admin. Used by every RLS policy.';

-- ---------------------------------------------------------------------------
-- Enable RLS. Deny-by-default: enabling it with no policies already blocks
-- everything, so the policies below are the complete, explicit grant list.
-- ---------------------------------------------------------------------------
alter table public.business_settings   enable row level security;
alter table public.feedback_submissions enable row level security;
alter table public.analytics_events    enable row level security;
alter table public.admin_users         enable row level security;

alter table public.business_settings   force row level security;
alter table public.feedback_submissions force row level security;
alter table public.analytics_events    force row level security;
alter table public.admin_users         force row level security;

-- ---------------------------------------------------------------------------
-- business_settings
--
-- Public shop configuration must be readable by the page it renders on. The
-- page reads it server-side through the service-role client, but the policy is
-- kept so a future SSR/anon read doesn't silently return nothing.
--
-- Deliberate consequence: contact_email / contact_address become readable with
-- the anon key. That is acceptable (they are published on /privacy anyway),
-- but it is the reason no sensitive field may ever be added to this table.
-- ---------------------------------------------------------------------------
drop policy if exists "settings readable by everyone" on public.business_settings;
create policy "settings readable by everyone"
  on public.business_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "settings updatable by admins" on public.business_settings;
create policy "settings updatable by admins"
  on public.business_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- feedback_submissions — admins may read; nobody may write from a client.
-- ---------------------------------------------------------------------------
drop policy if exists "feedback readable by admins" on public.feedback_submissions;
create policy "feedback readable by admins"
  on public.feedback_submissions
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- analytics_events — admins may read; nobody may write from a client.
-- ---------------------------------------------------------------------------
drop policy if exists "analytics readable by admins" on public.analytics_events;
create policy "analytics readable by admins"
  on public.analytics_events
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_users — an admin may see their own authorization record and the
-- allowlist is not enumerable. No writes from any client role.
-- ---------------------------------------------------------------------------
drop policy if exists "admin may read own record" on public.admin_users;
create policy "admin may read own record"
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Table privileges.
--
-- RLS filters rows; GRANTs decide which verbs a role may attempt at all.
-- Revoking INSERT/UPDATE/DELETE on the private tables is belt-and-braces on
-- top of the missing policies — two independent reasons a client write fails.
-- ---------------------------------------------------------------------------
revoke all on public.feedback_submissions from anon, authenticated;
grant select on public.feedback_submissions to authenticated;

revoke all on public.analytics_events from anon, authenticated;
grant select on public.analytics_events to authenticated;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

revoke all on public.business_settings from anon, authenticated;
grant select on public.business_settings to anon, authenticated;
grant update (name, logo_url, primary_color, welcome_title, welcome_message,
              google_review_url, contact_email, contact_address)
  on public.business_settings to authenticated;

-- Service role keeps full access (it bypasses RLS by design).
grant all on public.business_settings    to service_role;
grant all on public.feedback_submissions to service_role;
grant all on public.analytics_events     to service_role;
grant all on public.admin_users          to service_role;