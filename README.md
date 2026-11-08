# QR Feedback & Google Reviews

A single-shop, mobile-first feedback page. A customer scans a QR code at the
counter, picks 1–5 stars, optionally says what happened, and gets an AI-drafted
Google review they can edit before copying. No account, no app install.

The Google review link is available on every screen at every star rating. It is
never gated, never hidden behind a good score, and never styled as the "happy"
path. That is a product invariant, not a preference — see
[Non-negotiables](#non-negotiables).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 ·
Supabase (Postgres + Auth) · NVIDIA NIM (primary) / Google Gemini (fallback) · Upstash Redis (optional)

---

## Contents

1. [What you get](#what-you-get)
2. [Non-negotiables](#non-negotiables)
3. [Local setup](#local-setup)
4. [Supabase setup](#supabase-setup)
5. [Provision the first admin](#provision-the-first-admin)
6. [Verify row-level security](#verify-row-level-security)
7. [Environment variables](#environment-variables)
8. [Run it](#run-it)
9. [Deploy to Vercel](#deploy-to-vercel)
10. [Print the QR code](#print-the-qr-code)
11. [Retention](#retention)
12. [Tests](#tests)
13. [Troubleshooting](#troubleshooting)

---

## What you get

| Route             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `/`               | Redirects to the live shop slug read from the database        |
| `/r/[slug]`       | The customer flow: rate → describe → AI draft → copy → Google |
| `/privacy`        | Privacy notice, rendered from live `business_settings` values |
| `/admin/login`    | Email + password sign-in                                      |
| `/admin`          | Metrics, rating distribution, date-range filter               |
| `/admin/feedback` | Paginated shared feedback with rating and date filters        |
| `/admin/settings` | Shop name, colours, Google URL, contact details, QR panel     |

The Google review URL, shop name, colours and contact details all live in the
database, so you change them in `/admin/settings` **without a redeploy**.

## Non-negotiables

These are enforced in code, and tests will fail if they regress:

- **The Google link renders unconditionally**, on every step, for 1 star as
  well as 5. There is no rating-based routing anywhere.
- **Sharing written feedback is the action, not a checkbox.** Writing feedback
  into the flow and asking for a review _is_ the decision to share it, so there
  is no tick-box to clear. `POST /api/feedback` validates the payload against a
  strict schema and stamps each row with the published `privacy_notice_version`
  the customer was shown, which is the consent evidence.
- **Generated reviews are never persisted.** The AI draft exists in the
  customer's browser only. There is nothing to delete and nothing to leak.
- **Customer text is never logged.** API error logs carry an error code and a
  latency, never the feedback body.

## Local setup

Requires Node 22+.

```bash
npm install
cp .env.example .env.local     # then fill it in — see below
```

`lib/env.ts` validates every server variable with Zod at startup and throws a
readable error listing exactly what is missing or malformed. It fails fast and
loudly rather than 500ing at request time.

## Supabase setup

You need a Supabase project (free tier is fine). Nothing here is automated —
these are steps you run once.

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_init.sql` — tables, indexes, `updated_at` trigger
   - `supabase/migrations/0002_rls.sql` — RLS, `public.is_admin()`, policies
   - `supabase/migrations/0003_overview_rpc.sql` — dashboard aggregate RPC
   - `supabase/migrations/0004_retention.sql` — `pg_cron` retention job
   - `supabase/seed.sql` — the single `business_settings` row

   Or, with the Supabase CLI linked to your project:

   ```bash
   supabase db push
   ```

3. **Edit the seed row before launch.** `supabase/seed.sql` ships placeholders.
   Replace `google_review_url` with your real Google review link — either in the
   SQL before running it, or afterwards in `/admin/settings`. Omitting this is
   the single most common way to ship a broken page: the Google button would
   point at `REPLACE_WITH_YOUR_GOOGLE_REVIEW_LINK`.

4. From **Project Settings → API**, copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose)

### Why the slug matters

`/r/[slug]` is baked into the printed QR code. Changing the slug after printing
breaks every poster in the shop. Set it once in `business_settings` and leave it
alone. Everything else — the Google URL, the shop name, the colours — is safe to
change later.

## Provision the first admin

Admin access is an allowlist, not a role flag. A user can sign in successfully
and still be refused the dashboard unless their UUID is in `admin_users`.

1. **Authentication → Users → Add user** in Supabase. Set an email and password,
   and confirm the email (or disable email confirmation for the project).
2. Copy the new user's UUID.
3. In the SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('00000000-0000-0000-0000-000000000000');
   ```

   The table is deliberately just `user_id` (FK to `auth.users`) plus
   `created_at`. The email lives in `auth.users`; there is nothing to duplicate.

4. Sign in at `/admin/login`.

To revoke access, delete the `admin_users` row. The user may still authenticate,
but every admin route returns 401 and the dashboard never renders.

## Verify row-level security

RLS is deny-by-default: all four tables have RLS enabled **and forced**, and
there is no `INSERT` or `DELETE` policy anywhere. All writes go through route
handlers holding the service-role key, which bypasses RLS. Run these checks after
applying the migrations to confirm the browser-facing keys cannot read or write
data directly.

In the SQL Editor, run each block and confirm the result:

```sql
-- 1. RLS is on and forced for every table. Expect 4 rows, all true/true.
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('business_settings','feedback_submissions','analytics_events','admin_users')
  and relnamespace = 'public'::regnamespace;

-- 2. Inspect the complete policy set. Expect exactly five:
--      business_settings   select  (anon, authenticated)  → the public shop row
--      business_settings   update  (admin only)
--      feedback_submissions select (admin only)
--      analytics_events     select (admin only)
--      admin_users          select (own row)
--    There must be NO insert or delete policy on any table.
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' order by tablename, cmd;

-- 3. The anon role has no write grant on the private tables.
--    business_settings UPDATE is granted to `authenticated` only, and the
--    policy still requires is_admin(), so anon must show nothing here.
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and privilege_type in ('INSERT','UPDATE','DELETE');
```

Then prove it from the outside. With your real values, this must return an empty
array rather than rows — if it returns data, **stop and fix RLS before
deploying**:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/feedback_submissions?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# expected: []
```

And a write must be refused with 401/403, never 201:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/feedback_submissions" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rating":5}'
# expected: 401 or 403
```

## Environment variables

Copy `.env.example` → `.env.local`. Every variable is validated at boot.

| Variable                        | Exposure   | Notes                                                                       |
| ------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | public     | Project URL. `http://` allowed only for loopback hosts.                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public     | Safe to ship; RLS does the enforcing.                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | **secret** | Bypasses RLS. Server-only. Never prefix `NEXT_PUBLIC_`.                     |
| `GEMINI_API_KEY`                | **secret** | From [Google AI Studio](https://aistudio.google.com/apikey). Fallback provider. |
| `AI_MODEL`                      | server     | Google model. Defaults to `gemini-2.5-flash`.                               |
| `AI_FALLBACK_MODEL`             | server     | Google fallback model. Defaults to `gemini-2.5-flash-lite`.                 |
| `NVIDIA_API_KEY`                | **secret** | From [NVIDIA build](https://build.nvidia.com). Optional; when set, NVIDIA is the primary provider. |
| `NVIDIA_MODEL`                  | server     | Defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`. Bare id, no `model=` prefix. |
| `NEXT_PUBLIC_APP_URL`           | public     | Absolute origin. Canonical URLs, QR code, and the same-origin check.        |
| `UPSTASH_REDIS_REST_URL`        | server     | Optional. Absent ⇒ in-memory limiter.                                       |
| `UPSTASH_REDIS_REST_TOKEN`      | **secret** | Optional, paired with the URL.                                              |

**Rate limiting.** With Upstash configured, limits are shared across instances.
Without it, a per-process in-memory fallback applies — best-effort only on
serverless hosting, since each instance keeps its own counters. If Redis throws
at runtime, the limiter **degrades open** so the customer flow never breaks.
Limits: 8 review drafts / 5 min, 6 feedback writes / 10 min, 60 analytics / min,
8 login attempts / 5 min.

## Run it

```bash
npm run dev            # http://localhost:3000
npm run build && npm start
```

Quality gates — all four must pass before you deploy:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run test           # vitest — 98 unit tests
npm run test:e2e       # playwright — 114 tests across 3 viewports
npm run format:check   # prettier
```

## Deploy to Vercel

1. Push the repo and import it in Vercel. The framework preset is detected.
2. Add every variable from the table above under **Settings → Environment
   Variables**, scoped to Production (and Preview if you want preview deploys to
   work). `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` must **not** be
   `NEXT_PUBLIC_`.
3. Set `NEXT_PUBLIC_APP_URL` to the final custom domain, including scheme and no
   trailing slash — e.g. `https://reviews.yourshop.com`. The QR code and the
   canonical tags are generated from it.
4. Add the domain under **Settings → Domains** and let the certificate issue.
5. Redeploy after changing any environment variable; they are read at build and
   boot time, not per request.

> **CSP note.** `proxy.ts` adds `upgrade-insecure-requests` only when the request
> actually arrived over HTTPS. This is deliberate: emitting it on a plain-HTTP
> origin causes WebKit to rewrite subresource URLs to `https://127.0.0.1`, where
> nothing is listening — the page renders but never hydrates, and every button
> silently does nothing. Chrome exempts loopback and hides the bug. Do not
> "simplify" this back to a `NODE_ENV` check.

## Print the QR code

The QR code points at `NEXT_PUBLIC_APP_URL/r/<slug>`, not at Google. That is the
whole design: reprint nothing when the Google link changes.

Two ways to get it:

- **Admin panel.** `/admin/settings` shows a live preview and a
  **Download PNG (1024px)** button. This works on localhost, since it renders
  from `NEXT_PUBLIC_APP_URL` at request time.
- **CLI.** Generates an SVG (best for print) and a PNG into `./qr/`. With
  `NEXT_PUBLIC_APP_URL` set in `.env.local`, `npm run qr` derives
  `<APP_URL>/r/<slug>`. To override explicitly:

  ```bash
  npm run qr                                    # uses NEXT_PUBLIC_APP_URL + slug "shop"
  npm run qr -- --slug=shop --size=2048 --out=qr
  npm run qr -- --url=https://reviews.yourshop.com/r/shop --name="Corner Store"
  ```

  The script refuses any URL that is not `https://`, because a QR code that
  points at an insecure origin gets a certificate warning on the customer's
  phone. That means **`npm run qr` will not run against localhost** — use the
  admin panel for a local preview instead.

Before sending to print, scan the code with a real phone — not a desktop
scanner app — and confirm it lands on the feedback page. Check:

- it loads over the **public** domain, not `localhost`;
- the shop name and logo are correct;
- the **Review us on Google** link works and opens your business profile;
- it still works at 320px width in portrait.

Print at least 3cm square with a quiet zone; below that, older phone cameras
struggle under shop lighting.

## Retention

The documented policy is **180 days for feedback, 90 days for analytics**, and
**never for generated reviews** (they are never stored).

`0004_retention.sql` schedules a `pg_cron` job at 03:00 daily. If `pg_cron` is
unavailable on your plan, that migration will fail on
`create extension if not exists pg_cron` — skip the file and run the same two
statements on a schedule you control (Supabase Scheduled Functions, or a cron on
any always-on box):

```sql
delete from public.feedback_submissions where created_at < now() - interval '180 days';
delete from public.analytics_events       where created_at < now() - interval '90 days';
```

The privacy notice at `/privacy` states these periods. If you change them here,
update the notice text to match — a mismatch is a compliance problem, not a
cosmetic one.

## Tests

```bash
npm run test        # 98 Vitest units: validators, sanitizer, prompt,
                    # contrast math, http guards, rate-limit fallback
npm run test:e2e    # 114 Playwright tests on Pixel 7, iPhone 13, Desktop Chrome
```

E2E runs against a production build and a mock Supabase fixture, so it is
hermetic and consumes no provider quota — `/api/review-draft` is stubbed per spec.
The suite runs with `NVIDIA_API_KEY` empty, so the provider chain is Google-only
and no request can leave for NVIDIA.
If Playwright's browser binaries are missing:

```bash
npx playwright install --with-deps
```

Nothing in the suite is skipped: rate-limited specs declare their own
`x-forwarded-for`, so a shared IP budget can never turn a real assertion into a
skip.

## Troubleshooting

| Symptom                                            | Cause / fix                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Buttons do nothing; page looks fine                | JS never hydrated. Check for `upgrade-insecure-requests` in the CSP on a plain-HTTP origin — see the CSP note above. |
| `Invalid environment variables` at boot            | `lib/env.ts` lists the exact fields. Check for empty-string vs unset, and that URLs include the scheme.              |
| `/r/shop` shows a "not configured" notice          | No `business_settings` row. Run `supabase/seed.sql`.                                                                 |
| Admin login succeeds but `/admin` bounces to login | The user's UUID is not in `admin_users`.                                                                             |
| Review generation returns 502                      | Read the `[ai] attempt failed` log line. Its `provider=`/`status=` name the cause. NVIDIA: `400`/`404` = the model id is wrong or not enabled for your account (use the bare id, no `model=` prefix; the field is `reasoning_content`, so `content: null` plus `finish=length` means the token budget was spent thinking); timeouts = the model is too slow, pick a faster one. Google: `403` = the Cloud project is restricted or has no free tier; `400` = a parameter the model rejects; `429`/`5xx` = quota or an outage. When NVIDIA fails retryably the chain automatically tries Google. |
| `pg_cron` migration fails                          | Extension unavailable on your plan — see [Retention](#retention).                                                    |
| QR downloads but scans to `localhost`              | `NEXT_PUBLIC_APP_URL` is unset or still the default. Set it to the live domain and redeploy.                         |
