# Apprentice Atlas Product Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current discovery vertical slice into a coherent app with first-run personalization, a private application tracker, and a useful personal hub.

**Architecture:** Anonymous preferences live in AsyncStorage and immediately configure the existing discovery state. Authenticated application progress lives in a new RLS-protected Supabase table and is exposed through a typed client. A third native tab, “Mein Atlas”, combines application progress, preferences, and account controls; job details link into a focused status sheet.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, AsyncStorage, Supabase Postgres/RLS, Vitest, TypeScript.

## Global Constraints

- Keep map browsing available without login; application tracking requires authentication.
- Support German and English copy for every new user-facing string.
- Preserve the existing white/navy/strong-blue visual system and native iOS interaction patterns.
- Do not add a new runtime dependency.
- Do not modify or expose Supabase/OpenAI/provider secrets.
- Work in `/Users/timohaseloff/Apprentice-Atlas/.worktrees/product-layer/apprentice-atlas` and leave the main checkout's existing `app.json` change untouched.

---

### Task 1: First-run preferences and onboarding

**Files:**
- Create: `src/lib/preferences.ts`
- Create: `src/hooks/use-preferences.ts`
- Create: `src/app/onboarding.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/preferences.test.ts`

**Interfaces:**
- Produces `UserPreferences`, `DEFAULT_PREFERENCES`, `loadPreferences()`, `savePreferences()`, `completeOnboarding()`, and `usePreferences()`.
- `UserPreferences` contains `onboardingComplete`, `audience: 'student' | 'dropout' | null`, `interests: string[]`, `country: 'Germany' | 'United Kingdom' | null`, and `locale: 'de' | 'en'`.

- [x] Write tests proving malformed storage falls back safely, saved preferences round-trip, and completion applies country plus the first selected interest to discovery filters.
- [x] Run `npm test -- --run tests/preferences.test.ts` and verify the new tests fail because the preferences module is missing.
- [x] Implement the storage module and reactive hook using the existing AsyncStorage dependency and `useSyncExternalStore`.
- [x] Build a three-step native onboarding route: audience, interests, and country/language; include progress, back, and continue actions.
- [x] Add a root launch gate that redirects incomplete users to `/onboarding` only after preferences and locale hydration complete.
- [x] Run the focused test, TypeScript, and lint; commit with `feat: add personalized onboarding`.

### Task 2: Private application tracker data layer

**Files:**
- Create: `supabase/migrations/20260714190000_application_tracker.sql`
- Create: `src/lib/applications.ts`
- Modify: `src/types/jobs.ts`
- Test: `tests/applications.test.ts`
- Test: `tests/application-permissions.test.ts`

**Interfaces:**
- Produces `ApplicationStatus = 'interested' | 'preparing' | 'applied' | 'interview' | 'offer' | 'closed'` and `TrackedApplication` with its related `Job`.
- Produces `listApplications()`, `getApplicationForJob(jobId)`, `upsertApplication(jobId, status, note)`, and `removeApplication(jobId)` using the existing Supabase client pattern.

- [x] Write tests for status normalization, row mapping, optimistic-safe results, authentication errors, and SQL RLS/grants.
- [x] Run focused tests and verify they fail for the missing tracker implementation.
- [x] Add the `applications` table with owner-only select/insert/update/delete RLS, uniqueness on `(user_id, job_id)`, status validation, timestamps, and indexes.
- [x] Implement the typed client with safe error mapping and joined active job data.
- [x] Run focused tests, TypeScript, local SQL static checks, and lint; commit with `feat: add private application tracking`.

### Task 3: “Mein Atlas” personal hub and third tab

**Files:**
- Create: `src/app/(tabs)/atlas.tsx`
- Modify: `src/components/app-tabs.tsx`
- Modify: `src/components/app-tabs.web.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/atlas-summary.test.ts`

**Interfaces:**
- Consumes `usePreferences()`, `useAuth()`, and `listApplications()`.
- Produces pure helpers `summarizeApplications()` and `groupApplications()` for deterministic progress UI.

- [x] Write tests for application counts and active/finished grouping.
- [x] Run the focused test and verify it fails for the missing summary helpers.
- [x] Add the third native/web tab named `atlas` with person/route iconography and localized “Mein Atlas” / “My Atlas” labels.
- [x] Build the hub with a progress overview, active application cards, an empty state leading back to discovery, preferences summary/edit action, and account sign-in/sign-out state.
- [x] Keep unauthenticated users useful: show preferences and explain that login unlocks private tracking.
- [x] Run focused tests, TypeScript, lint, and a 390×844 web visual check; commit with `feat: add My Atlas hub`.

### Task 4: Status sheet and job-detail integration

**Files:**
- Create: `src/app/application/[jobId].tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/job/[id].tsx`
- Modify: `src/lib/i18n.ts`
- Test: `tests/application-flow.test.ts`

**Interfaces:**
- Consumes tracker CRUD and auth.
- The status sheet supports all six statuses, an optional note up to 500 characters, save, and remove.

- [x] Write static/behavior tests proving the detail route exposes tracking, unauthenticated users are routed through auth with a return target, and the sheet saves only validated statuses/notes.
- [x] Run focused tests and verify they fail for the missing route and integration.
- [x] Add an “Application journey” row to job details without crowding the persistent Apply/Save bar.
- [x] Build a native form sheet with status choices, note input, save/remove states, and clear localized errors.
- [x] Refresh the hub when it regains focus so edited statuses appear immediately.
- [x] Run tests, TypeScript, lint, and narrow/normal iPhone web checks; commit with `feat: connect jobs to application journey`.

### Task 5: Integration, Supabase readiness, and handoff

**Files:**
- Modify: `README.md`
- Modify only where verification reveals a concrete defect.

- [x] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx expo-doctor`, `npx expo export --platform web`, and `npx expo export --platform ios --output-dir dist-ios-check`.
- [x] Verify onboarding, anonymous discovery, auth return, status editing, My Atlas empty/populated states, German/English, and 320/390 width behavior.
- [x] Apply the new migration to the linked Supabase project only after local checks pass; verify table, RLS, and grants.
- [x] Document the new product flows and the migration in README.
- [x] Dispatch final spec and code-quality reviews; fix every actionable issue.
- [x] Merge `codex/product-layer` into `main` without overwriting the main checkout's pre-existing `app.json` change.
