# Apprentice Atlas Supabase

This directory contains the database migration and **local-development-only** fixtures for Apprentice Atlas. The rows in `seed.sql` are fictional, clearly marked fixtures and must never be presented as live vacancies or production-source data.

## Local usage

From `apprentice-atlas/`, install and authenticate the Supabase CLI, then run:

```sh
npx supabase start
npx supabase db reset
```

`db reset` applies `supabase/migrations/001_initial_schema.sql`, then `002_harden_schema_integrity.sql`, and finally `supabase/seed.sql`. To inspect or validate migration state, use `npx supabase migration list --local` and `npx supabase db lint --local` where supported. Docker (or another Docker-compatible runtime) is required for the local stack.

## Production-source rule

Production jobs may only be ingested by trusted Supabase Edge Functions or other server-side code using the service role. Those functions must use approved official-source adapters, retain the official source URL and external ID, and write provider payloads to `job_sources`. The client must never receive source payloads, sync-run records, provider credentials, or the service-role key. Do not load `seed.sql` into production.

### Official sources and access boundaries

- **United Kingdom — Find an apprenticeship Display Advert API v2:** the official live base endpoint is `https://api.apprenticeships.education.gov.uk/vacancies`. Use the [official Display Advert API developer documentation](https://developer.apprenticeships.education.gov.uk/Documentation/display-advert-api-v2), including its API-key and version-header requirements. Calls belong in a server-side adapter; never expose the API key in the app.
- **Germany — Bundesagentur für Arbeit Jobsuche:** this is the intended official German source, surfaced through the [BA Jobsuche](https://www.arbeitsagentur.de/jobsuche). The official read API endpoint, API availability for this product, authentication requirements, rate limits, and reuse terms still need confirmation directly with the Bundesagentur für Arbeit. Until that confirmation is recorded, do not implement against an assumed endpoint or treat third-party API documentation as an official access grant.

No-scraping rule: Apprentice Atlas must not scrape either source's public website or bypass authentication, rate limits, robots controls, or terms of use. Ingestion is permitted only through a confirmed, authorized official API/feed or an explicitly approved server-side integration. Every adapter must keep credentials server-side, preserve the canonical source URL, and record the provider external ID.

RLS exposes only active jobs and published translations to anonymous/authenticated clients. Favorites are private to the authenticated owner. `job_sources`, `sync_runs`, and cached AI content have no client read policies; ingestion and AI functions are responsible for privileged access.

Each `sync_runs` row records a provider configuration run, not an individual `job_sources` row. `provider` identifies the adapter and `source_key` must be namespaced as `provider:configuration` (for example, `find-apprenticeship:default`); the migration check prevents a mismatched provider prefix. During the `001` to `002` upgrade, rows that join to `job_sources` with a non-empty external ID are backfilled as `sync_runs.provider:external_id`, even if the listing's provider differs. Rows with no join or an empty external ID receive `sync_runs.provider:legacy-<sync-run-id-or-old-source-id>` so their run identity is retained, but that fallback is not a claim about a verified source configuration. Individual external listings remain in `job_sources`.

The MVP deliberately stores latitude/longitude as numeric columns and uses bounding-box filtering. PostGIS is intentionally not required yet.
