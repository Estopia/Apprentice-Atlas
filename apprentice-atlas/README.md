# Apprentice Atlas

Apprentice Atlas helps students and university dropouts turn nearby opportunities into a concrete next step. The app combines location-aware map discovery, grounded job details and AI guidance with first-run personalization, private saved jobs, and a personal application journey. The complete product UI is bilingual (English/German).

## Product flows

- Browse official apprenticeship and early-career listings on the map without an account. Search, filters, list mode, location access, and manual location fallback all remain available anonymously.
- Complete a three-step first-run setup for audience, interests, country, and language. Preferences persist locally and preconfigure discovery after a cold start.
- Open a job for its official description, source metadata, application link, simple AI explanation, fit guidance, and limited grounded Q&A.
- Save jobs or track a private application after signing in. The application journey covers interested, preparing, applied, interview, offer, and closed, with an optional private note.
- Prepare for a specific interview with 3–5 grounded practice questions and an honest skill-gap view. The editable background/skills draft stays on the device; it is sent transiently for the requested analysis and is not written to the shared job AI cache.
- Set an interview date, hand application deadlines or interviews to the native calendar, and receive an optional device-local reminder three days before a saved listing closes. Notification identifiers never sync to the account.
- Export a human-readable, high-contrast A4 account PDF or retain the versioned JSON export. The PDF includes account preferences, saved opportunities, and application progress, but excludes full listing descriptions, auth credentials, local notification identifiers, and the career-profile draft.
- Open a 9:16 share preview for a job and share a locally generated PNG with title, company, location, original source attribution, and a validated `apprenticeatlas://job/<uuid>` link. Web and devices without file sharing use localized plain text instead.
- Use My Atlas / Mein Atlas as the personal hub for progress, active and completed applications, preferences, and account controls. Expired listings already in a journey remain manageable.

Browsing does not require login. Favorites, application tracking, and other private account data do. Authentication returns users to the exact safe route and pending action they started.

## How we built Apprentice Atlas with Codex and GPT-5.6

We did not use Codex for a one-shot prototype. We used it as a persistent, repository-aware product and engineering partner from the first specification to the physical iPhone build. The collaboration followed a repeatable loop:

1. Define the user problem and product boundary.
2. Turn the decision into a small, testable specification.
3. Let Codex implement a focused vertical slice.
4. Test it in the browser and on a physical iPhone.
5. Give direct product and visual feedback, then iterate.
6. Run automated checks and independent review passes before merging.

That loop mattered because “working” was not the same as “good.” Early versions loaded jobs and rendered a map, but they also exposed real weaknesses: an EAS dependency mismatch, a native launch crash, map searches that refreshed too aggressively, an empty filter sheet, and UI that felt closer to a responsive website than a finished mobile product. Codex helped diagnose and repair each problem in the actual codebase. We then rejected designs that still felt generic, used Mobbin references to sharpen the native interaction patterns, and iterated again on hierarchy, spacing, navigation, company visuals, and information density.

### Where Codex accelerated the project

- **Spec-driven delivery:** Codex converted product discussions into acceptance criteria, implementation plans, typed interfaces, and bounded development tasks. This kept a fast build from becoming an unreviewable collection of generated components.
- **Expo and native debugging:** It traced EAS failures to an out-of-sync npm lockfile, resolved Expo 57 native framework compatibility, investigated a launch-time iOS crash, and built a readiness-aware Lottie splash flow for the physical development client.
- **Full-stack implementation:** It produced and connected Expo Router screens, native map/list discovery, bilingual onboarding, magic-link and Apple authentication, Supabase clients, Edge Functions, migrations, RLS policies, storage boundaries, and official job-source adapters.
- **Product-quality iteration:** Codex used our iPhone feedback and Mobbin references to move the app from a map demo to a richer product: adaptive Home, persistent native tabs, search history, recommendation ranking, application tracking, deadlines, interview preparation, exports, share cards, and company branding.
- **Regression protection:** New behavior was paired with tests for ranking, authentication return paths, RLS/RPC boundaries, job normalization, source synchronization, AI schemas, native tools, navigation, accessibility, and launch readiness.
- **Review loops:** Larger slices were checked against their specification and then reviewed again for security, runtime behavior, code quality, and edge cases. One review, for example, caught that Home could show recommendations from the onboarding country after the user had manually switched countries.
- **Documentation and handoff:** Codex kept setup commands, secret boundaries, migration order, native-build requirements, limitations, and verification steps in the repository instead of leaving critical knowledge inside a chat.

### The decisions stayed product-led

Codex accelerated exploration and implementation, but it did not choose the product for us. We made the decisions that define Apprentice Atlas:

- Focus on students and people leaving university without a degree.
- Launch for Germany and the United Kingdom in German and English.
- Use official apprenticeship APIs rather than scraping websites.
- Keep browsing open without an account, while protecting saved jobs and application data behind authentication.
- Make location useful but optional, with manual fallback when permission is denied.
- Separate the map into its own tab and make Home an adaptive next-step dashboard instead of opening directly into a wall of pins.
- Keep AI grounded in the selected listing, admit when information is missing, and avoid pretending to know an employer’s intent.
- Test native behavior on a physical iPhone rather than treating the web preview as proof that the mobile experience was finished.

The most valuable collaboration was often a disagreement with an early result. When a screen felt sparse, text-heavy, overly web-like, or visually generic, we said so. Codex inspected the screenshots, compared relevant native patterns, preserved the working data flows, and rebuilt the presentation. That back-and-forth is visible in the commit history and is a major reason the final app feels like a coherent product rather than an AI-generated demo.

### What GPT-5.6 does in the shipped product

Codex helped build the product; GPT-5.6 powers the user-facing intelligence inside it. The model is called only through protected Supabase Edge Functions and receives the canonical job record, not an untrusted client-authored substitute.

| Experience | GPT-5.6 contribution | Product safeguard |
| --- | --- | --- |
| “In simple words” | Rewrites dense vacancy text in clear, youth-friendly language. | The original listing and official source remain available. |
| “Good if…” / “Not so good if…” | Turns requirements and working conditions into balanced fit guidance. | Output must follow a validated structured schema and stay grounded in the listing. |
| Job Q&A | Answers practical questions such as “What would I actually do all day?” | Questions are limited, evidence-aware, and return an explicit unknown state when the advert does not say. |
| Interview preparation | Generates 3–5 role-specific practice questions and answer guidance. | The canonical vacancy is fetched server-side; the user’s local draft is processed transiently. |
| Skill-gap view | Compares a short user-provided background with the stated requirements. | It distinguishes matches, learning areas, and positioning tips without inventing qualifications. |

The OpenAI key and model configuration never ship in the app. Edge Functions validate inputs and structured outputs, use `store: false` for personal preparation requests, and keep the editable background draft on the device. This makes GPT-5.6 a meaningful part of the experience while preserving an honest boundary between source facts, model interpretation, and private user data.

### Evidence of the collaboration

The current repository passes **362 automated tests**, with **7 environment-gated integration tests skipped**, plus TypeScript, Expo lint, Expo Doctor **20/20**, and a static Expo web export. The app has also been exercised through EAS development builds on a physical iPhone. These checks cover more than generated boilerplate: they verify authentication ownership, database permissions, official-source normalization, map behavior, AI response contracts, application state transitions, local-only data, accessibility, and native-tool fallbacks.

## Local web testing

This repository uses Expo SDK 57 (`expo` `~57.0.6`) with Expo Router and React Native Web.

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

Calendar handoff, local notifications, haptics, StoreKit review prompts, PDF generation, file sharing, and share-card capture use native Expo modules. After changing those dependencies or plugins, install a fresh development build before testing them on a device; an older Expo Go/development client cannot gain native modules from JavaScript alone. Calendar access is write-only and opens/creates only user-requested deadline or interview events. Notifications are local only; remote background notifications are disabled. PDF and PNG file sharing are native features with honest localized web fallbacks, while JSON/plain-text sharing remains available where the platform supports it.

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
16. `20260715142000_scope_user_assets_to_user_folder.sql`
17. `20260715150000_ai_prepare_quota.sql`
18. `20260715160128_application_interview_date.sql`

The preflight is required before the locked schema hardening migration because it repairs legacy whitespace/blanks and normalized source collisions. The guarded post-release migration is safe on clean data and completes compatibility, audit, and constraint hardening. The application tracker migration and its privilege-hardening follow-up are applied to the hosted project. They enforce owner-only RLS, immutable application identity, restricted column updates, and authenticated access to the validated upsert RPC. The local-only `supabase/fixtures/preflight_source_provenance.sql` fixture is for testing the legacy repair path; load it after the initial schema and before the preflight, then apply the remaining timestamp migrations. Never load fixtures or `seed.sql` into production.

If a remote project has old `001`/`002`/`003` history, back it up and inspect the actual schema before applying the initial migration. Use `npx supabase migration list --linked`, then pair `npx supabase migration repair <old-id> --status reverted` with `npx supabase migration repair <timestamp-id> --status applied` only when the timestamp SQL is already represented in the database. For partial or uncertain upgrades, stop, pull/inspect the schema, and do not mark a migration applied without evidence. After repair, list history again and run `npx supabase db push --linked`. `migration repair` changes history only; it does not run SQL.

## Data, auth, AI, and source boundaries

- The browser/mobile client receives only active jobs and published translations through RLS. Jobs remain discoverable with canonical title, description, and location fields when a requested published translation is absent. Favorites and applications are private to the signed-in owner.
- Application creation uses a validated security-definer RPC. Direct client inserts, table-wide updates, identity-column changes, and anonymous access are revoked; owners may read/delete their rows and update only status, note, and optional interview date through the allowed boundary.
- `job_sources`, `sync_runs`, provider payloads, cached AI content, and the Supabase service-role key are server-side only.
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`; `OPENAI_MODEL=gpt-5.6` is optional and defaults to that model in the handlers. Configure them as Supabase project secrets, never as `EXPO_PUBLIC_*` values:

  ```sh
  npx supabase secrets set OPENAI_API_KEY="<key>" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" OPENAI_MODEL="gpt-5.6"
  ```

The hosted `ai-explain`, `ai-qa`, and `sync-jobs` Edge Functions are deployed. Before using AI or live source synchronization, add the server-only OpenAI, UK, and optional BA credentials through Supabase project secrets; the public app key is already configured locally.

- AI explanations and Q&A are grounded in the selected job record. Q&A is limited server-side to two questions per job and opaque app session. Job-specific preparation is authenticated, fetches the canonical listing server-side, validates a structured response, and calls OpenAI with `store: false`; the submitted personal background is processed transiently and is not persisted by the Edge Function. Do not enter sensitive personal data into questions or the local preparation draft.
- Preferences, the preparation draft, review gating, and local reminder identifiers use device storage. Only authenticated account data such as favorites, application status/note, and interview date syncs to Supabase. Calendar events, PDF reports, and share-card PNGs are created only after a user action and handed to the selected native destination.
- UK ingestion uses the documented official Display Advert API v2 endpoint (`https://api.apprenticeships.education.gov.uk/vacancies/vacancy`) and v2 request contract. That documentation reference is separate from runtime activation: synchronization refuses to run unless the server-only `UK_API_CONTRACT_CONFIRMED=true` flag is explicitly configured alongside the API key. Germany ingestion uses BA-hosted Jobsuche search and detail endpoints and remains server-only; `BA_API_ENABLED`, `BA_API_URL`, `BA_DETAIL_API_URL`, and `BA_API_KEY` configure it, while `BA_SYNC_MAX_PAGES` and bounded detail concurrency keep each run controlled. No website scraping is used.

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

The current product passes 362 automated tests with 7 environment-gated integration tests skipped, Expo lint, TypeScript, Expo Doctor (20/20), and a static web export. Earlier product-layer checks also included a static iOS export and interactive web checks at 320×844 and 390×844. The application RPC integration test was run successfully against a disposable PostgreSQL database with every timestamped migration applied. Native development builds have been installed and exercised on a physical iPhone; dependency or config-plugin changes still require a fresh EAS build before device testing.

## Known limitations

- Local seed data is fictional; official ingestion remains server-side and configuration-gated.
- Discovery uses numeric latitude/longitude and bounding-box filtering; PostGIS is not currently required.
- A physical-device native build requires EAS credentials, signing, and (for Android) the restricted maps key.
- Location permission denial falls back to manual city/country selection. AI availability depends on configured Edge Function secrets and network access.
- Application notes are private text fields, not document uploads or a full employer-facing application system. The actual application is completed on the official provider page.
