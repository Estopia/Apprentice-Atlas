# Apprentice Atlas

Apprentice Atlas helps students and university dropouts turn nearby opportunities into a concrete next step. The app combines location-aware map discovery, grounded job details and AI guidance with first-run personalization, private saved jobs, and a personal application journey. The complete product UI is bilingual (English/German).

## Product flows

- Browse official apprenticeship and early-career listings on the map without an account. Search, filters, list mode, location access, and manual location fallback all remain available anonymously.
- Complete a three-step first-run setup for audience, interests, country, and language. Preferences persist locally and preconfigure discovery after a cold start.
- Open a job for its official description, source metadata, application link, simple AI explanation, fit guidance, and limited grounded Q&A.
- Save jobs or track a private application after signing in. The application journey covers interested, preparing, applied, interview, offer, and closed, with an optional private note.
- Use My Atlas / Mein Atlas as the personal hub for progress, active and completed applications, preferences, and account controls. Expired listings already in a journey remain manageable.

Browsing does not require login. Favorites, application tracking, and other private account data do. Authentication returns users to the exact safe route and pending action they started.

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
npx eas env:create --name GOOGLE_MAPS_API_KEY --value "<android-key>" --scope project --environment development --visibility sensitive
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
npx expo start --dev-client
```

`GOOGLE_MAPS_API_KEY` is an Android-only EAS environment value. Create it in the `development` environment with `sensitive` visibility because that is the environment used by the `development` build profile. Restrict it in Google Cloud to the Android application and Maps SDK services. iOS uses Apple Maps and remains buildable without this key. Do not put it in an `EXPO_PUBLIC_*` variable or commit it.

## Supabase setup and migrations

The hosted project is `apprentice-atlas` (`zslmbyxmvyzuropzxjjy`) in `eu-central-1`. The local `.env.local` is configured with its public URL and publishable key. Never commit that file or any server secret.

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
10. `20260714150000_enforce_source_listing_urls.sql`
11. `20260714160000_enforce_application_urls.sql`
12. `20260714170000_user_assets_storage.sql`
13. `20260714180000_index_favorites_job_id.sql`
14. `20260714190000_application_tracker.sql`
15. `20260714191000_harden_application_privileges.sql`

The preflight is required before the locked schema hardening migration because it repairs legacy whitespace/blanks and normalized source collisions. The guarded post-release migration is safe on clean data and completes compatibility, audit, and constraint hardening. The application tracker migration and its privilege-hardening follow-up are applied to the hosted project. They enforce owner-only RLS, immutable application identity, restricted column updates, and authenticated access to the validated upsert RPC. The local-only `supabase/fixtures/preflight_source_provenance.sql` fixture is for testing the legacy repair path; load it after the initial schema and before the preflight, then apply the remaining timestamp migrations. Never load fixtures or `seed.sql` into production.

If a remote project has old `001`/`002`/`003` history, back it up and inspect the actual schema before applying the initial migration. Use `npx supabase migration list --linked`, then pair `npx supabase migration repair <old-id> --status reverted` with `npx supabase migration repair <timestamp-id> --status applied` only when the timestamp SQL is already represented in the database. For partial or uncertain upgrades, stop, pull/inspect the schema, and do not mark a migration applied without evidence. After repair, list history again and run `npx supabase db push --linked`. `migration repair` changes history only; it does not run SQL.

## Data, auth, AI, and source boundaries

- The browser/mobile client receives only active jobs and published translations through RLS. Jobs remain discoverable with canonical title, description, and location fields when a requested published translation is absent. Favorites and applications are private to the signed-in owner.
- Application creation uses a validated security-definer RPC. Direct client inserts, table-wide updates, identity-column changes, and anonymous access are revoked; owners may read/delete their rows and update only status/note through the allowed boundary.
- `job_sources`, `sync_runs`, provider payloads, cached AI content, and the Supabase service-role key are server-side only.
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`; `OPENAI_MODEL=gpt-5.6` is optional and defaults to that model in the handlers. Configure them as Supabase project secrets, never as `EXPO_PUBLIC_*` values:

  ```sh
  npx supabase secrets set OPENAI_API_KEY="<key>" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" OPENAI_MODEL="gpt-5.6"
  ```

The hosted `ai-explain`, `ai-qa`, and `sync-jobs` Edge Functions are deployed. Before using AI or live source synchronization, add the server-only OpenAI, UK, and optional BA credentials through Supabase project secrets; the public app key is already configured locally.

- AI explanations and Q&A are grounded in the selected job record. Q&A is limited server-side to two questions per job and opaque app session. Do not enter sensitive personal data into questions.
- UK ingestion uses the documented official Display Advert API v2 endpoint (`https://api.apprenticeships.education.gov.uk/vacancies/vacancy`) and v2 request contract. That documentation reference is separate from runtime activation: synchronization refuses to run unless the server-only `UK_API_CONTRACT_CONFIRMED=true` flag is explicitly configured alongside the API key. Germany BA ingestion is likewise disabled by default and requires server-only `BA_API_ENABLED=true`, `BA_API_URL`, and `BA_API_KEY`. No website scraping or guessed API contract is allowed.

## Codex and GPT-5.6 roles

Codex was used as an engineering and review partner for Expo components, native interaction flows, Supabase migrations/RLS, Edge Functions, typed clients, official API adapters, validation, tests, and documentation. Development was split into bounded subagent tasks, with independent specification and security/code-quality reviews after each product slice. Codex also drove narrow and standard iPhone web visual checks before integration. GPT-5.6 powers the user-facing plain-language explanations, “Good if” / “Not so good if” fit lists, and limited job Q&A through the server-side Edge Functions. These are separate boundaries: the app never exposes provider secrets.

## Verification

From `apprentice-atlas/`:

```sh
npm test
npm run lint
npx tsc --noEmit
npx expo export --platform web
npx expo export --platform ios --output-dir /tmp/apprentice-atlas-ios-export
npx expo-doctor
npx expo config --type public
```

The product-layer handoff passed 133 automated tests with 6 environment-gated integration tests skipped, Expo lint, TypeScript, Expo Doctor (20/20), static web export, static iOS export, and interactive checks at 320×844 and 390×844. The native development profiles should still be validated with `npx eas build:configure`/`npx eas build --profile development --platform <ios|android>` when EAS credentials and a device are available.

## Known limitations

- Local seed data is fictional; official ingestion remains server-side and configuration-gated.
- Discovery uses numeric latitude/longitude and bounding-box filtering; PostGIS is not currently required.
- A physical-device native build requires EAS credentials, signing, and (for Android) the restricted maps key.
- Location permission denial falls back to manual city/country selection. AI availability depends on configured Edge Function secrets and network access.
- Application notes are private text fields, not document uploads or a full employer-facing application system. The actual application is completed on the official provider page.
