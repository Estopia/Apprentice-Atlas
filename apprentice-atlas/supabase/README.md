# Apprentice Atlas Supabase

This directory contains the database migration and **local-development-only** fixtures for Apprentice Atlas. The rows in `seed.sql` are fictional, clearly marked fixtures and must never be presented as live vacancies or production-source data.

## Local usage

From `apprentice-atlas/`, install and authenticate the Supabase CLI, then run:

```sh
npx supabase start
npx supabase db reset
```

`db reset` applies every timestamped migration in filename order, then `supabase/seed.sql`:

1. `20260713090000_initial_schema.sql` — base tables, RLS, and public visibility.
2. `20260713091000_preflight_source_cleanup.sql` — guarded cleanup for legacy source metadata and normalized collisions before the integrity checks.
3. `20260713092000_harden_schema_integrity.sql` — locked release-candidate provenance, constraints, indexes, and expiration-aware visibility baseline.
4. `20260713093000_preserve_source_identifiers.sql` — guarded compatibility backfills, collision repair, permanent source constraints, and protected identifier audit fields.
5. `20260714100000_atomic_job_source_sync.sql` — service-role-only atomic provider-listing and canonical-job upsert RPC.
6. `20260714110000_atomic_stale_expiration.sql` — service-role-only atomic stale-source retirement and unreferenced-job expiration RPC.
7. `20260714120000_application_url.sql` — nullable direct application URL support for jobs and sources.
8. `20260714130000_job_ai_qa_sessions.sql` — service-role-only per-job, per-session question counters and consume/release RPCs.
9. `20260714140000_add_favorite_rpc.sql` — authenticated-owner favorite add/remove RPCs.
10. `20260714150000_enforce_source_listing_urls.sql` — HTTP(S) source URL checks and sync validation for jobs and source listings.
11. `20260714160000_enforce_application_urls.sql` — optional strict HTTP(S) application destination checks for jobs.

The preflight is required before locked `20260713092000` for existing imports because it repairs legacy source whitespace/blanks and normalized collisions; it is guarded and harmless on clean data. `20260713093000` is also guarded and can finish compatible intermediate schemas. Do not edit an existing migration or insert a new migration between these files; append later migrations with a newer timestamp. To inspect or validate migration state, use `npx supabase migration list --local` and `npx supabase db lint --local` where supported. Docker (or another Docker-compatible runtime) is required for the local stack.

Clean deployments use only these timestamp-prefixed migration files. The local-only [`preflight_source_provenance.sql`](fixtures/preflight_source_provenance.sql) fixture can be loaded after the initial schema and before preflight to exercise a non-null malformed `source_key` with a joinable `source_id`; it is not part of the normal reset seed.

### One-time migration-history repair

This repository has no deployed Supabase migration history. If an environment may have applied the former `001`/`002`/`003` filenames, do not run the initial schema blindly. First back up the database, inspect the actual schema, and compare history with:

```sh
npx supabase migration list --linked
```

For each old ID, repair the remote `supabase_migrations.schema_migrations` history according to what actually happened. If an old migration completed and its schema is equivalent to the corresponding timestamp migration, mark the old ID reverted and mark the timestamp ID applied—these commands change history only and do not run SQL:

```sh
npx supabase migration repair 001 --status reverted
npx supabase migration repair 20260713090000 --status applied
```

Use the same paired procedure for each old migration whose SQL is already represented, mapping old `001`/`002`/`003` to the corresponding timestamped schema migrations after verifying the actual database. The six `20260714*` migrations are new additions and should be applied normally with `npx supabase db push --linked`; do not mark them applied unless their SQL is already present. If an old migration was recorded but did not complete, mark only that old ID reverted and leave its timestamp migration unapplied so `db push` can run it. For partial or uncertain upgrades, stop and inspect or pull the remote schema before repairing; never mark a migration applied without confirming its SQL is already represented. After repair, run `npx supabase migration list --linked`, then apply the timestamp chain. Supabase documents that `migration repair` updates history only; it does not apply or revert SQL.

## Production-source rule

Production jobs may only be ingested by trusted Supabase Edge Functions or other server-side code using the service role. Those functions must use approved official-source adapters, retain the official source URL and external ID, and write provider payloads to `job_sources`. The client must never receive source payloads, sync-run records, provider credentials, or the service-role key. Do not load `seed.sql` into production.

### Official sources and access boundaries

- **United Kingdom — Find an apprenticeship Display Advert API v2:** the official live base endpoint is `https://api.apprenticeships.education.gov.uk/vacancies`. Use the [official Display Advert API developer documentation](https://developer.apprenticeships.education.gov.uk/Documentation/display-advert-api-v2), including its API-key and version-header requirements. Calls belong in a server-side adapter; never expose the API key in the app.
- **Germany — Bundesagentur für Arbeit Jobsuche:** the BA adapter uses the official Jobsuche REST contract at `https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs`, with `X-API-Key: jobboerse-jobsuche`, `angebotsart=4` (Ausbildung/Duales Studium), and the documented `stellenangebote`/`maxErgebnisse`/`page`/`size` response fields. It retains the official BA job-detail URL derived from `refnr` and keeps an optional `externeUrl` as the separate application URL. The adapter accepts only records whose documented `arbeitsort.land` is `Deutschland`.

No-scraping rule: Apprentice Atlas must not scrape either source's public website or bypass authentication, rate limits, robots controls, or terms of use. Ingestion is permitted only through a confirmed, authorized official API/feed or an explicitly approved server-side integration. Every adapter must keep credentials server-side, preserve the canonical source URL, and record the provider external ID.

RLS exposes only active jobs and published translations to anonymous/authenticated clients. Favorites are private to the authenticated owner. `job_sources`, `sync_runs`, and cached AI content have no client read policies; ingestion and AI functions are responsible for privileged access.

AI Q&A uses `job_ai_qa_sessions` keyed by `(job_id, session_id)`. The client generates an opaque UUID per app session and the service-role-only `consume_job_ai_question` RPC atomically permits only the first two questions for each job/session pair. A new session UUID resets the allowance; no login is required and the client-supplied display count is not trusted for enforcement.

The synchronization function claims a provider listing and its canonical job through `20260714100000`'s `upsert_job_source` RPC. The RPC serializes the `(provider, external_id)` claim with a transaction advisory lock, returns the canonical `job_id`, and preserves an existing job's `created_at` while applying fresh normalized fields. Each listing/source claim is atomic, but a sync run is deliberately not one whole-run transaction: if a later page or listing fails, earlier successful listings remain committed and the `sync_runs` row is marked failed; stale expiration is not attempted. Complete runs retire stale sources and expire their unreferenced jobs through `20260714110000`'s `expire_stale_source_jobs` RPC in one transaction. Both RPCs are service-role-only.

Each `sync_runs` row records a provider configuration run, not an individual `job_sources` row. `provider` identifies the adapter that performed the sync and remains the prefix for `source_key`, which must be namespaced as `provider:configuration` (for example, `find-apprenticeship:default`). Nullable `source_provider` records the provider attached to the matched source listing, preserving a mismatch when it differs from the sync provider; its exact-trim/non-empty check applies whenever it is present. The preflight runs before locked `002` so existing imports cannot fail its exact source checks: it trims providers, repairs blank providers/external IDs, resolves normalized `(provider, external_id)` collisions deterministically, and preserves changed external IDs in `legacy_external_id`. On intermediate schemas that already have sync provenance columns, it also normalizes run providers and prepares invalid keys for 002; on fresh 001 it leaves those columns for 002 to add. The locked `002` establishes the baseline sync provenance, indexes, translation check, and expiration-aware public visibility. `003` completes compatibility backfills, reapplies normalization and collision repair defensively, adds permanent source constraints/uniqueness, reapplies translation/public visibility hardening, and installs protected `legacy_external_id` audit behavior. Duplicate or repaired source rows retain their prior raw external ID; caller-supplied audit values and overwrites are rejected. Existing non-empty but invalid source keys are copied to nullable `legacy_source_key` before being replaced with `sync_runs.provider:legacy-run-<sync-run-id>`. Rows with no join receive that separate deterministic run-level fallback, which is not a claim about a verified source configuration. Individual external listings remain in `job_sources`. The later `20260714120000` migration adds `application_url`; `20260714130000` enforces the two-question per-job/session allowance; and `20260714140000` keeps favorite ownership inside authenticated RPCs.

## Synchronization verification

From `apprentice-atlas/`, `npm run test -- tests` runs the complete suite. The PostgreSQL expiration integration tests skip locally only when `TASK3_TEST_DATABASE_URL` and `TEST_DATABASE_URL` are both unset. `.github/workflows/test.yml` provisions disposable PostgreSQL, creates the Supabase-compatible roles, applies every timestamped migration, sets both variables, and runs the same command, so the real database tests are enforced in CI.

To run the real source/expiration integration tests locally, start a temporary PostgreSQL instance, apply the timestamped migrations, and run with `TASK3_TEST_DATABASE_URL` (or `TEST_DATABASE_URL`) set. To validate the legacy provenance path locally, apply `20260713090000_initial_schema.sql`, then `fixtures/preflight_source_provenance.sql`, then `20260713091000_preflight_source_cleanup.sql` and the remaining timestamped migrations; the `legacy-provenance` CI job contains the exact order and assertions.

The MVP deliberately stores latitude/longitude as numeric columns and uses bounding-box filtering. PostGIS is intentionally not required yet.
