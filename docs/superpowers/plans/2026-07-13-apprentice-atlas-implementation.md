# Apprentice Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual Expo mobile app that lets students and university dropouts discover official apprenticeship and entry-level opportunities, understand them with GPT-5.6, save them, compare them, and open the original listing.

**Architecture:** The Expo/React Native client reads normalized jobs and authenticated favorites from Supabase. Supabase Edge Functions synchronize official sources and call GPT-5.6 server-side, with cached localized AI content and strict JSON validation. The app remains browsable without login; Supabase Auth gates favorites and comparison.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Supabase Auth/Postgres/Edge Functions, `react-native-maps`, `expo-location`, GPT-5.6, and Vitest for pure data/prompt tests.

---

## File map

Create focused modules under `apprentice-atlas/`:

- `src/types/jobs.ts`: canonical job, filter, AI, and favorite types.
- `src/lib/supabase.ts`: one configured Supabase client.
- `src/lib/jobs.ts`: job queries and filter serialization.
- `src/lib/favorites.ts`: authenticated favorite operations.
- `src/lib/ai.ts`: typed Edge Function calls.
- `src/lib/i18n.ts`: German/English strings and locale selection.
- `src/hooks/use-location.ts`: permission and manual-location fallback.
- `src/components/map/job-map.tsx`: map and markers.
- `src/components/jobs/job-card.tsx`: reusable compact job presentation.
- `src/components/jobs/job-filters.tsx`: country/category/distance filters.
- `src/components/jobs/ai-explanation.tsx`: summary and fit lists.
- `src/components/jobs/job-qa.tsx`: two-question interaction.
- `src/app/index.tsx`: discovery screen.
- `src/app/job/[id].tsx`: job details.
- `src/app/favorites.tsx`: saved jobs and comparison.
- `src/app/auth.tsx`: login and registration.
- `supabase/migrations/001_initial_schema.sql`: tables, indexes, and RLS.
- `supabase/functions/sync-jobs/index.ts`: source synchronization entry point.
- `supabase/functions/ai-explain/index.ts`: explanation and fit-list function.
- `supabase/functions/ai-qa/index.ts`: grounded question answering.
- `supabase/functions/_shared/`: validation, normalization, prompts, and source adapters.
- `tests/`: pure tests for normalization, filters, prompts, and API response validation.

Existing starter components in `src/components/` may be retained only where they serve the new UI; the Expo tutorial screens and copy should be removed once replacement screens exist.

## Task 1: Establish dependencies, environment, and shared contracts

**Files:**

- Modify: `apprentice-atlas/package.json`
- Create: `apprentice-atlas/.env.example`
- Create: `apprentice-atlas/src/types/jobs.ts`
- Create: `apprentice-atlas/src/lib/supabase.ts`
- Create: `apprentice-atlas/src/lib/i18n.ts`
- Modify: `apprentice-atlas/tsconfig.json` only if path aliases need adjustment

- [ ] Add `@supabase/supabase-js`, `expo-location`, `react-native-maps`, and the selected test packages. Keep versions compatible with Expo SDK 57.
- [ ] Add environment names `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and server-only names for Edge Functions to `.env.example`; never place OpenAI or source API secrets in `EXPO_PUBLIC_*` variables.
- [ ] Define `Job`, `JobFilter`, `JobExplanation`, `JobQuestionAnswer`, and `FavoriteJob` interfaces with the same property names used by the database and Edge Functions.
- [ ] Implement `getSupabaseClient()` using the two public Supabase variables and fail with a readable configuration error when either is missing.
- [ ] Implement `Locale = 'de' | 'en'`, a locale store/hook, and a typed `t(locale, key)` function covering navigation, location permission, login gate, loading, errors, save, apply, and AI labels.
- [ ] Run `npm install`, `npm run lint`, and `npx tsc --noEmit` from `apprentice-atlas/`; expected result is no type or lint error.
- [ ] Commit: `chore: add app contracts and service configuration`.

## Task 2: Create Supabase schema and security policies

**Files:**

- Create: `apprentice-atlas/supabase/migrations/001_initial_schema.sql`
- Create: `apprentice-atlas/supabase/seed.sql`
- Create: `apprentice-atlas/supabase/README.md`

- [ ] Create `jobs` with UUID primary key, normalized job fields, coordinates, source URL, `status`, `last_seen_at`, `expires_at`, and timestamps.
- [ ] Create `job_sources` with provider, external ID, source URL, raw payload JSON, and a unique `(provider, external_id)` constraint.
- [ ] Create `sync_runs` with source, status, counts, error details, and start/end timestamps.
- [ ] Create `job_translations`, `favorites`, and `job_ai_content`, including unique `(job_id, language)` constraints where applicable.
- [ ] Add indexes for `country`, `city`, `status`, `category`, and `job_type`; use a latitude/longitude bounding-box filter for the first map query so the MVP does not require PostGIS.
- [ ] Enable RLS on user-owned tables. Allow a user to select/insert/delete only their own favorites; allow public read access only to active jobs and published translations; keep raw source payloads server-side.
- [ ] Add seed fixtures only for local development and tests, clearly marked as fixtures rather than production source data.
- [ ] Apply the migration in a local or staging Supabase project and verify the RLS policies with an anonymous client and an authenticated test user.
- [ ] Commit: `feat: add jobs and favorites database schema`.

## Task 3: Implement official-source synchronization boundaries

**Files:**

- Create: `apprentice-atlas/supabase/functions/_shared/normalize-job.ts`
- Create: `apprentice-atlas/supabase/functions/_shared/source-adapter.ts`
- Create: `apprentice-atlas/supabase/functions/_shared/uk-apprenticeship-adapter.ts`
- Create: `apprentice-atlas/supabase/functions/_shared/ba-adapter.ts`
- Create: `apprentice-atlas/supabase/functions/sync-jobs/index.ts`
- Create: `apprentice-atlas/tests/normalize-job.test.ts`
- Create: `apprentice-atlas/tests/filter-jobs.test.ts`

- [ ] Define `SourceAdapter` with `provider`, `fetchPage(cursor)`, and `normalize(record)` so each official source has an isolated implementation.
- [ ] Implement normalization into the canonical `Job` shape, rejecting records without title, source ID, source URL, company, or usable location data.
- [ ] Implement the UK Display Advert API adapter using server-side `Ocp-Apim-Subscription-Key` and version headers; store the source external ID and original URL.
- [ ] Implement the BA adapter behind the same interface, but fail clearly when the official read credentials or endpoint configuration are absent; do not add an HTML fallback.
- [ ] In `sync-jobs`, upsert `job_sources` by provider/external ID, upsert normalized jobs, mark previously seen jobs as expired only after a complete successful source run, and insert a `sync_runs` record with counts and errors.
- [ ] Respect provider rate limits, bound page size, and make the function idempotent.
- [ ] Write tests for malformed records, duplicate external IDs, missing coordinates, expiration behavior, and filter serialization.
- [ ] Run `npx vitest run tests/normalize-job.test.ts tests/filter-jobs.test.ts`; expected result is PASS.
- [ ] Commit: `feat: add official job synchronization interfaces`.

## Task 4: Build the client job data layer and discovery shell

**Files:**

- Create: `apprentice-atlas/src/lib/jobs.ts`
- Create: `apprentice-atlas/src/hooks/use-jobs.ts`
- Create: `apprentice-atlas/src/hooks/use-location.ts`
- Create: `apprentice-atlas/src/components/map/job-map.tsx`
- Create: `apprentice-atlas/src/components/jobs/job-card.tsx`
- Create: `apprentice-atlas/src/components/jobs/job-filters.tsx`
- Modify: `apprentice-atlas/src/app/index.tsx`
- Modify: `apprentice-atlas/src/app/_layout.tsx`

- [ ] Implement `listJobs(filters)` against active Supabase jobs, returning a typed list and a stable error shape.
- [ ] Implement location permission request, current coordinates, selected country/city, and manual fallback state; never block browsing if permission is denied.
- [ ] Build the map with markers keyed by job ID and a list fallback for loading, empty, denied-location, and API-error states.
- [ ] Add country, category, and distance filters and preserve them while navigating to a job.
- [ ] Replace the Expo starter home screen with the discovery flow and update tabs/routes to expose discovery and favorites.
- [ ] Add the first DE/EN labels and a visible language switcher.
- [ ] Run the app on iOS simulator and Android emulator/device; verify marker tap, manual location, denied permission, and empty results.
- [ ] Commit: `feat: add bilingual map discovery flow`.

## Task 5: Add job details and GPT-5.6 Edge Functions

**Files:**

- Create: `apprentice-atlas/src/lib/ai.ts`
- Create: `apprentice-atlas/src/components/jobs/ai-explanation.tsx`
- Create: `apprentice-atlas/src/components/jobs/job-qa.tsx`
- Create: `apprentice-atlas/src/app/job/[id].tsx`
- Create: `apprentice-atlas/supabase/functions/_shared/prompts.ts`
- Create: `apprentice-atlas/supabase/functions/_shared/ai-schema.ts`
- Create: `apprentice-atlas/supabase/functions/ai-explain/index.ts`
- Create: `apprentice-atlas/supabase/functions/ai-qa/index.ts`
- Create: `apprentice-atlas/tests/prompt-schema.test.ts`

- [ ] Add the typed job detail query and display source, last-updated date, title, company, location, type, requirements, raw description, and external application link.
- [ ] Put the approved explanation and Q&A prompt templates in `_shared/prompts.ts`; include language, job data, grounding rules, missing-information behavior, and JSON response requirements.
- [ ] Validate incoming job ID, language, question length, and authenticated/anonymous request limits in each Edge Function.
- [ ] Call GPT-5.6 only from Edge Functions, parse the structured response, reject invalid output, and return a safe fallback error.
- [ ] Cache explanation results in `job_ai_content` per job and language; keep Q&A responses ephemeral.
- [ ] Build explanation sections and a two-question Q&A UI with loading, retry, limit-reached, and unknown-information states.
- [ ] Test prompt payloads and response validation with valid, malformed, and missing-field fixtures.
- [ ] Run the prompt tests and exercise both functions against a staging job with secrets configured; expected result is valid localized JSON and a cached explanation.
- [ ] Commit: `feat: add grounded GPT-5.6 job explanations`.

## Task 6: Add authentication, favorites, and comparison

**Files:**

- Create: `apprentice-atlas/src/lib/auth.ts`
- Create: `apprentice-atlas/src/lib/favorites.ts`
- Create: `apprentice-atlas/src/hooks/use-auth.ts`
- Create: `apprentice-atlas/src/components/auth/auth-form.tsx`
- Create: `apprentice-atlas/src/app/auth.tsx`
- Create: `apprentice-atlas/src/app/favorites.tsx`
- Modify: `apprentice-atlas/src/app/job/[id].tsx`
- Modify: `apprentice-atlas/src/app/_layout.tsx`

- [ ] Implement Supabase session subscription, email/password sign-in, registration, sign-out, and readable auth errors.
- [ ] Implement favorite insert/delete/list operations and optimistic UI only with rollback on failure.
- [ ] Make the save action work anonymously until pressed; then route to auth and return to the originating job after successful login.
- [ ] Build favorites with title, company, location, job type, source date, remove action, and a compact comparison view.
- [ ] Verify the client cannot read or mutate another user’s favorites under RLS.
- [ ] Run an end-to-end manual flow: browse without login, open details, tap save, register, save, reopen favorites, remove, sign out.
- [ ] Commit: `feat: add auth-gated favorites and comparison`.

## Task 7: Polish, verification, and project documentation

**Files:**

- Modify: `apprentice-atlas/src/constants/theme.ts`
- Modify: `apprentice-atlas/src/components/` focused replacement components only
- Modify: `apprentice-atlas/README.md`
- Modify: `apprentice-atlas/app.json` if location permissions or map configuration require it
- Create: `apprentice-atlas/docs/demo-script.md`

- [ ] Replace remaining Expo starter copy and assets with Apprentice Atlas branding, bilingual copy, and the confirmed empty/error/loading states.
- [ ] Configure iOS and Android location permission messages and verify that no secret is bundled into the client.
- [ ] Check small and large phones in both languages, including long job titles, missing optional fields, dark mode if retained, keyboard behavior, and external-link behavior.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, and `npx vitest run`; fix all failures before recording.
- [ ] Update README with product flow, architecture, official-source policy, GPT-5.6 grounding rules, Codex usage, local setup, environment variables, migrations, and known BA API access prerequisite.
- [ ] Write `docs/demo-script.md` for the English comedy skit: student panic, God recommends Apprentice Atlas, screen recording narration, save/apply flow, and the Codex punchline.
- [ ] Commit: `docs: finalize Apprentice Atlas setup and demo guide`.

## Verification checklist

- [ ] Anonymous user can browse jobs with device location or manual city fallback.
- [ ] German and English UI and AI output are selectable and consistent.
- [ ] Every displayed job has an official source URL and visible freshness information.
- [ ] Explanation and Q&A never expose provider/API secrets and return grounded structured responses.
- [ ] Q&A stops after two questions per job/session.
- [ ] Login is required only for save/compare, not browsing.
- [ ] Favorites are isolated by Supabase RLS.
- [ ] Expired or invalid source records do not appear as active map markers.
- [ ] iOS and Android builds launch and the core flow works on both.
