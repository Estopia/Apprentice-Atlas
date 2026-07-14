# Apprentice Atlas

Apprentice Atlas helps students find a realistic next step after school. The app combines location-aware discovery, map-based browsing, job details, grounded AI explanations and Q&A, private saved jobs, and a direct application link. The product UI is bilingual (English/German); the demo script is intentionally English.

## Local web testing

This repository uses Expo SDK 57 (`expo` `~57.0.4`) with Expo Router and React Native Web.

```sh
npm install
cp .env.example .env.local
# add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local
npx expo start --web
```

The web build is also checked without starting a server:

```sh
npx expo export --platform web
```

Run `npx expo config --type public` to inspect the resolved public config. The Android maps plugin is added only when `EAS_BUILD_PLATFORM=android` and `GOOGLE_MAPS_API_KEY` are present, so iOS and web config validation do not need an Android maps key.

## Expo development clients

`eas.json` contains a physical-device `development` profile: it uses `developmentClient: true`, internal distribution, an iOS device build, and an Android APK. Credentials and keys are not committed.

```sh
npx eas login
npx eas env:create --name GOOGLE_MAPS_API_KEY --value "<android-key>" --scope project
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
npx expo start --dev-client
```

`GOOGLE_MAPS_API_KEY` is an Android-only EAS environment value. Restrict it in Google Cloud to the Android application and Maps SDK services. iOS uses Apple Maps and remains buildable without this key. Do not put it in an `EXPO_PUBLIC_*` variable or commit it.

## Supabase setup and migrations

The client only needs the public URL and anon key in `.env.local`. Start a local Supabase stack from this directory with Docker available:

```sh
npx supabase start
npx supabase db reset
npx supabase migration list --local
npx supabase db lint --local
```

Clean databases apply every timestamp migration in filename order, then `supabase/seed.sql` for fictional local fixtures. The migration order is:

1. `20260713090000_initial_schema.sql`
2. `20260713091000_preflight_source_cleanup.sql`
3. `20260713092000_harden_schema_integrity.sql`
4. `20260713093000_preserve_source_identifiers.sql`
5. `20260714100000_atomic_job_source_sync.sql`
6. `20260714110000_atomic_stale_expiration.sql`
7. `20260714120000_application_url.sql`
8. `20260714130000_job_ai_qa_sessions.sql`
9. `20260714140000_add_favorite_rpc.sql`

The preflight is required before the locked schema hardening migration because it repairs legacy whitespace/blanks and normalized source collisions. The guarded post-release migration is safe on clean data and completes compatibility, audit, and constraint hardening. The local-only `supabase/fixtures/preflight_source_provenance.sql` fixture is for testing the legacy repair path; load it after the initial schema and before the preflight, then apply the remaining timestamp migrations. Never load fixtures or `seed.sql` into production.

If a remote project has old `001`/`002`/`003` history, back it up and inspect the actual schema before applying the initial migration. Use `npx supabase migration list --linked`, then pair `npx supabase migration repair <old-id> --status reverted` with `npx supabase migration repair <timestamp-id> --status applied` only when the timestamp SQL is already represented in the database. For partial or uncertain upgrades, stop, pull/inspect the schema, and do not mark a migration applied without evidence. After repair, list history again and run `npx supabase db push --linked`. `migration repair` changes history only; it does not run SQL.

## Data, auth, AI, and source boundaries

- The browser/mobile client receives only active jobs and published translations through RLS. Favorites are private to the signed-in owner.
- `job_sources`, `sync_runs`, provider payloads, cached AI content, and the Supabase service-role key are server-side only.
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`; `OPENAI_MODEL=gpt-5.6` is optional and defaults to that model in the handlers. Configure them as Supabase project secrets, never as `EXPO_PUBLIC_*` values:

  ```sh
  npx supabase secrets set OPENAI_API_KEY="<key>" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" OPENAI_MODEL="gpt-5.6"
  ```

- AI explanations and Q&A are grounded in the selected job record. Q&A is limited server-side to two questions per job and opaque app session. Do not enter sensitive personal data into questions.
- UK ingestion is pending confirmation of the official Display Advert API v2 contract and access details. The BA read API contract, availability, authentication, and reuse terms are also pending direct confirmation. No website scraping or guessed API contract is allowed.

## Codex and GPT-5.6 roles

Codex was used as an engineering and review partner for Expo components, Supabase queries and Edge Functions, typed clients, official API adapters, validation, tests, and documentation. GPT-5.6 powers the user-facing plain-language explanations, “Good if” / “Not so good if” fit lists, and limited job Q&A through the server-side Edge Functions. These are separate boundaries: the app never exposes provider secrets.

## Verification

From `apprentice-atlas/`:

```sh
npm test
npm run lint
npx tsc --noEmit
npx expo export --platform web
npx expo config --type public
```

The native development profiles should be validated with `npx eas build:configure`/`npx eas build --profile development --platform <ios|android>` when EAS credentials and a device are available. This task does not require an actual native build.

## Known limitations

- Official UK and German provider contracts are pending; local seed data is fictional.
- The MVP uses numeric latitude/longitude and bounding-box filtering; PostGIS is not required yet.
- A physical-device native build requires EAS credentials, signing, and (for Android) the restricted maps key.
- Location permission denial falls back to manual city/country selection. AI availability depends on configured Edge Function secrets and network access.
