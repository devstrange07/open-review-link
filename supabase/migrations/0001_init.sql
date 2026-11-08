-- ===========================================================================
-- 0001_init.sql — tables, constraints, indexes
--
-- Single-shop deployment. Column names match the specification, plus
-- contact_email / contact_address on business_settings so the privacy notice
-- has a real business contact to display.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- business_settings — exactly one row, id = 1
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  id                     smallint    primary key default 1,
  name                   text        not null check (length(trim(name)) between 1 and 80),
  slug                   text        not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url               text,
  primary_color          text        not null default '#245C47'
                                     check (primary_color ~ '^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$'),
  welcome_title          text        not null check (length(trim(welcome_title)) between 1 and 80),
  welcome_message        text        not null check (length(trim(welcome_message)) between 1 and 200),
  google_review_url      text        not null check (google_review_url ~ '^https://'),
  privacy_notice_version text        not null default 'v1',
  contact_email          text        not null check (position('@' in contact_email) > 1),
  contact_address        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Only one configuration record is allowed.
  constraint business_settings_single_row check (id = 1)
);

comment on column public.business_settings.privacy_notice_version is
  'Stamped onto each feedback row so we know which notice the customer agreed to.';
comment on column public.business_settings.contact_email is
  'Shown on the privacy page. Not collected from customers.';

-- ---------------------------------------------------------------------------
-- feedback_submissions — only rows the customer explicitly agreed to share
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_submissions (
  id                     uuid        primary key default gen_random_uuid(),
  business_id            smallint    not null references public.business_settings(id)
                                     on update cascade on delete restrict,
  rating                 smallint    not null check (rating between 1 and 5),
  feedback_text          text        check (
                                       feedback_text is null
                                       or length(feedback_text) <= 1500
                                     ),
  consent_notice_version text        not null check (length(trim(consent_notice_version)) > 0),
  consented_at           timestamptz not null,
  created_at             timestamptz not null default now(),

  -- Consent and its evidence travel together: a stored row without a consent
  -- timestamp would be stored data we cannot justify.
  constraint feedback_consent_recorded check (consented_at <= created_at)
);

comment on table public.feedback_submissions is
  'Private feedback shared with the shop after affirmative consent. Never contains AI drafts, names, emails or device identifiers.';

-- ---------------------------------------------------------------------------
-- analytics_events — anonymous counters only
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id          uuid        primary key default gen_random_uuid(),
  business_id smallint    not null references public.business_settings(id)
                          on update cascade on delete cascade,
  event_name  text        not null check (event_name in (
                            'page_opened',
                            'rating_selected',
                            'ai_generation_succeeded',
                            'ai_generation_failed',
                            'feedback_saved',
                            'review_copied',
                            'google_review_clicked'
                          )),
  created_at  timestamptz not null default now()
);

comment on table public.analytics_events is
  'Counts, not identities. No IP addresses, user agents, free text or customer identifiers are stored here.';

-- ---------------------------------------------------------------------------
-- admin_users — allowlist of Supabase Auth accounts with dashboard access
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Manually provisioned. A row here is the only thing that grants dashboard access.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists feedback_submissions_created_at_idx
  on public.feedback_submissions (created_at desc);

create index if not exists feedback_submissions_rating_idx
  on public.feedback_submissions (rating);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

-- Composite helpers for the dashboard's "last N days, filtered by rating" path.
create index if not exists feedback_submissions_business_created_at_idx
  on public.feedback_submissions (business_id, created_at desc);

create index if not exists analytics_events_business_name_created_at_idx
  on public.analytics_events (business_id, event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_settings_touch_updated_at on public.business_settings;
create trigger business_settings_touch_updated_at
  before update on public.business_settings
  for each row execute function public.touch_updated_at();