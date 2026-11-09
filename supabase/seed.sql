-- ===========================================================================
-- seed.sql — the single shop row
--
-- Replace name, slug, google_review_url and contact details before going live.
-- Safe to re-run: it only inserts when the row is missing, so it will not
-- clobber values you have edited in the admin dashboard.
-- ===========================================================================

insert into public.business_settings (
  id,
  name,
  slug,
  logo_url,
  primary_color,
  welcome_title,
  welcome_message,
  google_review_url,
  privacy_notice_version,
  contact_email,
  contact_address
)
values (
  1,
  'Poojara Telecom Kalol (Opp. Bus Stand)',
  'poojara-telecom-kalol',
  null,
  '#245C47',
  'Thank you for visiting!',
  'We''d love to hear about your experience.',
  'https://g.page/r/CSkWByQnxLfTEAE/review',
  'v2',
  'kalol.ptpl@gmail.com',
  'Kaival Agency, C/o, Road, opp. Bus Stop, Math Faliya, Vadodara, Kalol, Gujarat 389330'
)
on conflict (id) do nothing;