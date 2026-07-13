# Apprentice Atlas Supabase

This directory contains the database migration and **local-development-only** fixtures for Apprentice Atlas. The rows in `seed.sql` are fictional, clearly marked fixtures and must never be presented as live vacancies or production-source data.

## Local usage

From `apprentice-atlas/`, install and authenticate the Supabase CLI, then run:

```sh
npx supabase start
npx supabase db reset
```

`db reset` applies `supabase/migrations/001_initial_schema.sql` and then `supabase/seed.sql`. To inspect or validate migration state, use `npx supabase migration list --local` and `npx supabase db lint --local` where supported. Docker (or another Docker-compatible runtime) is required for the local stack.

## Production-source rule

Production jobs may only be ingested by trusted Supabase Edge Functions or other server-side code using the service role. Those functions must use approved official-source adapters, retain the official source URL and external ID, and write provider payloads to `job_sources`. The client must never receive source payloads, sync-run records, provider credentials, or the service-role key. Do not load `seed.sql` into production.

RLS exposes only active jobs and published translations to anonymous/authenticated clients. Favorites are private to the authenticated owner. `job_sources`, `sync_runs`, and cached AI content have no client read policies; ingestion and AI functions are responsible for privileged access.

The MVP deliberately stores latitude/longitude as numeric columns and uses bounding-box filtering. PostGIS is intentionally not required yet.
