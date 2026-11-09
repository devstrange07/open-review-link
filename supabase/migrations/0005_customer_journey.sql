-- ===========================================================================
-- 0005_customer_journey.sql — optional topics, reference ID, service recovery
-- ===========================================================================

-- Opaque reference customers can quote when asking for deletion.
alter table public.feedback_submissions
  add column if not exists public_reference text;

update public.feedback_submissions
set public_reference = 'qrfb_' || replace(gen_random_uuid()::text, '-', '')
where public_reference is null;

alter table public.feedback_submissions
  alter column public_reference set not null;

alter table public.feedback_submissions
  alter column public_reference set default ('qrfb_' || replace(gen_random_uuid()::text, '-', ''));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_submissions_public_reference_key'
  ) then
    alter table public.feedback_submissions
      add constraint feedback_submissions_public_reference_key unique (public_reference);
  end if;
end $$;

create index if not exists feedback_submissions_public_reference_idx
  on public.feedback_submissions (public_reference);

comment on column public.feedback_submissions.public_reference is
  'Customer-facing deletion reference. Shown after submit; never the internal UUID.';

-- Allowlisted improvement topics (empty array = none selected).
alter table public.feedback_submissions
  add column if not exists improvement_topics text[] not null default '{}';

comment on column public.feedback_submissions.improvement_topics is
  'Allowlisted topic ids the customer selected. Empty when skipped.';

-- Optional follow-up phone for dissatisfied customers (explicit consent required).
alter table public.feedback_submissions
  add column if not exists follow_up_consent boolean not null default false;

alter table public.feedback_submissions
  add column if not exists follow_up_consent_at timestamptz;

alter table public.feedback_submissions
  add column if not exists contact_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feedback_follow_up_phone_requires_consent'
  ) then
    alter table public.feedback_submissions
      add constraint feedback_follow_up_phone_requires_consent check (
        (follow_up_consent = false and contact_phone is null and follow_up_consent_at is null)
        or (
          follow_up_consent = true
          and contact_phone is not null
          and length(trim(contact_phone)) between 8 and 20
          and follow_up_consent_at is not null
        )
      );
  end if;
end $$;

comment on column public.feedback_submissions.follow_up_consent is
  'True only when the customer opted in to a phone follow-up.';
comment on column public.feedback_submissions.contact_phone is
  'Optional phone for service recovery. Stored only with follow_up_consent.';

-- Bump privacy notice version for the expanded disclosure.
update public.business_settings
set privacy_notice_version = 'v2'
where id = 1
  and privacy_notice_version = 'v1';

-- Refresh paginated feedback RPC to expose new columns.
create or replace function public.get_feedback_page(
  p_page    integer default 1,
  p_limit   integer default 20,
  p_rating  smallint default null,
  p_from    timestamptz default null,
  p_to      timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with filtered as (
    select
      id,
      rating,
      feedback_text,
      consent_notice_version,
      consented_at,
      created_at,
      public_reference,
      improvement_topics,
      follow_up_consent,
      contact_phone
    from public.feedback_submissions
    where business_id = 1
      and (p_rating is null or rating = p_rating)
      and (p_from   is null or created_at >= p_from)
      and (p_to     is null or created_at <  p_to)
  ),
  page_rows as (
    select *
    from filtered
    order by created_at desc, id desc
    limit greatest(1, least(p_limit, 100))
    offset (greatest(1, p_page) - 1) * greatest(1, least(p_limit, 100))
  )
  select jsonb_build_object(
    'total', (select count(*)::int from filtered),
    'rows', coalesce(
      (select jsonb_agg(to_jsonb(page_rows) order by created_at desc, id desc) from page_rows),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_feedback_page(integer, integer, smallint, timestamptz, timestamptz) from public;
revoke all on function public.get_feedback_page(integer, integer, smallint, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.get_feedback_page(integer, integer, smallint, timestamptz, timestamptz) to service_role;
