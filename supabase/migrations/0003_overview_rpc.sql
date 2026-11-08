-- ===========================================================================
-- 0003_overview_rpc.sql — dashboard aggregation
--
-- One round trip for every metric on /admin. Doing this in SQL keeps the
-- numbers consistent (a single snapshot) and avoids pulling rows into Node
-- just to count them.
-- ===========================================================================

create or replace function public.get_admin_overview(
  p_from timestamptz,
  p_to   timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with feedback_in_range as (
    select rating
    from public.feedback_submissions
    where business_id = 1
      and created_at >= p_from
      and created_at <  p_to
  ),
  event_counts as (
    select event_name, count(*)::int as total
    from public.analytics_events
    where business_id = 1
      and created_at >= p_from
      and created_at <  p_to
    group by event_name
  ),
  distributions as (
    select rating, count(*)::int as total
    from feedback_in_range
    group by rating
  )
  select jsonb_build_object(
    'totalFeedback',
      (select count(*)::int from feedback_in_range),
    'averageRating',
      (select round(avg(rating)::numeric, 2) from feedback_in_range),
    'fiveStarCount',
      (select count(*)::int from feedback_in_range where rating = 5),
    'ratingDistribution',
      jsonb_build_object(
        '1', coalesce((select total from distributions where rating = 1), 0),
        '2', coalesce((select total from distributions where rating = 2), 0),
        '3', coalesce((select total from distributions where rating = 3), 0),
        '4', coalesce((select total from distributions where rating = 4), 0),
        '5', coalesce((select total from distributions where rating = 5), 0)
      ),
    'events',
      (
        select coalesce(jsonb_object_agg(event_name, total), '{}'::jsonb)
        from event_counts
      ),
    'range',
      jsonb_build_object(
        'from', p_from,
        'to',   p_to
      )
  );
$$;

revoke all on function public.get_admin_overview(timestamptz, timestamptz) from public;
revoke all on function public.get_admin_overview(timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.get_admin_overview(timestamptz, timestamptz) to service_role;

comment on function public.get_admin_overview(timestamptz, timestamptz) is
  'Aggregate dashboard metrics. service_role only: these numbers are shop-private.';

-- ===========================================================================
-- Paginated feedback read
--
-- Filters are optional; ordering is fixed newest-first so the client cannot
-- request an expensive sort on an unindexed column.
-- ===========================================================================
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
    select id, rating, feedback_text, consent_notice_version, consented_at, created_at
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