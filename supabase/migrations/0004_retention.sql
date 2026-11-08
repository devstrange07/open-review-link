-- ===========================================================================
-- 0004_retention.sql — documented retention enforcement
--
-- Policy:
--   feedback_submissions  180 days
--   analytics_events       90 days
--   generated reviews      never persisted (nothing to delete)
--
-- Implemented with pg_cron. If the extension is unavailable on your plan, skip
-- this file and enable the Vercel Cron fallback documented in README.md, which
-- calls the same deletion via a token-protected route handler.
-- ===========================================================================

create extension if not exists pg_cron;

-- Remove any previous schedule so this migration is idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'qr_feedback_retention') then
    perform cron.unschedule('qr_feedback_retention');
  end if;
end;
$$;

-- 03:00 daily. Two statements in one job so the schedule has a single owner.
select cron.schedule(
  'qr_feedback_retention',
  '0 3 * * *',
  $job$
    delete from public.feedback_submissions
    where created_at < now() - interval '180 days';

    delete from public.analytics_events
    where created_at < now() - interval '90 days';
  $job$
);

comment on extension pg_cron is
  'Runs the documented retention policy for feedback (180d) and analytics (90d).';