# Apprentice Atlas Prepare & Progress Tools Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to implement this plan task by task, with a fresh implementer, spec review, and code-quality review for each task.

**Goal:** Turn Apprentice Atlas from a discovery MVP into a practical application companion with job-specific AI preparation, satisfying tracker feedback, deadline/calendar support, portable exports, and story-ready sharing.

**Architecture:** Keep personal preparation input and device integration state private and device-local unless the existing authenticated application record must sync. Add one authenticated `ai-prepare` Supabase Edge Function that reads the canonical listing server-side and returns strictly validated structured JSON without caching personal data. Use native Expo modules behind small testable adapters; persist only `interview_at` in Supabase, while notification IDs, review gating, and profile drafts remain in AsyncStorage.

**Tech Stack:** Expo 57, React Native 0.86, Expo Router, TypeScript, Supabase Auth/Postgres/Edge Functions, OpenAI Responses API (`gpt-5.6`), Vitest, Reanimated, Expo Haptics/Notifications/Calendar/Print/Sharing/StoreReview, react-native-view-shot.

---

## Task 1: Native foundations and deterministic domain helpers

**Files:**
- Modify: `apprentice-atlas/package.json`
- Modify: `apprentice-atlas/package-lock.json`
- Modify: `apprentice-atlas/app.json`
- Modify: `apprentice-atlas/src/app/_layout.tsx`
- Create: `apprentice-atlas/src/lib/native-feedback.ts`
- Create: `apprentice-atlas/src/lib/review-prompt.ts`
- Create: `apprentice-atlas/src/lib/deadline-reminders.ts`
- Create: `apprentice-atlas/src/lib/calendar-sync.ts`
- Test: `apprentice-atlas/tests/native-tools.test.ts`

### Step 1: Write failing domain tests

Cover:
- review requests only after the first successful non-offer -> offer transition and at most once per app version;
- reminder time is exactly three days before a future listing deadline and omitted when already applied, missing, or in the past;
- only `/job/<uuid>` notification routes are accepted;
- calendar payloads use the listing deadline or tracked interview date and never invent contact data.

### Step 2: Verify the tests fail

Run: `npm test -- tests/native-tools.test.ts`
Expected: FAIL because helpers do not exist.

### Step 3: Install SDK-compatible native dependencies and configure plugins

Use npm 10 for lockfile generation so optional peer dependencies required by EAS remain represented. Add Expo-compatible versions of `expo-haptics`, `expo-notifications`, `expo-calendar`, `expo-print`, `expo-sharing`, `expo-store-review`, `react-native-view-shot`, and the Expo-compatible community datetime picker. Configure local notifications and write-only calendar access with clear DE/EN-neutral iOS permission copy. Do not enable remote background notifications.

### Step 4: Implement thin native adapters

- Haptics must no-op safely on web and expose selection, success, and error feedback.
- Review gating must persist the last prompted app version and let StoreKit decide whether to show its standard prompt.
- Reminder scheduling must store device-specific notification identifiers in AsyncStorage and support cancellation by job/user.
- Calendar export must open a native event form or use write-only creation without reading the user's calendar.
- Root layout must register a foreground notification handler and route validated notification taps through Expo Router.

### Step 5: Verify and commit

Run: `npm test -- tests/native-tools.test.ts && npx tsc --noEmit && npm run lint && npm ci --include=dev`
Expected: PASS, and `npm ci` confirms package/lock consistency.

Commit: `feat: add native progress tool foundations`

## Task 2: Authenticated AI interview and skill-gap preparation

**Files:**
- Modify: `apprentice-atlas/src/types/jobs.ts`
- Modify: `apprentice-atlas/src/lib/ai.ts`
- Modify: `apprentice-atlas/src/lib/auth.ts`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Modify: `apprentice-atlas/src/app/_layout.tsx`
- Modify: `apprentice-atlas/src/app/job/[id].tsx`
- Modify: `apprentice-atlas/src/app/(tabs)/atlas.tsx`
- Create: `apprentice-atlas/src/app/prepare/[jobId].tsx`
- Create: `apprentice-atlas/src/lib/career-profile.ts`
- Modify: `apprentice-atlas/supabase/functions/_shared/ai-schema.ts`
- Modify: `apprentice-atlas/supabase/functions/_shared/prompts.ts`
- Create: `apprentice-atlas/supabase/functions/ai-prepare/handler.ts`
- Create: `apprentice-atlas/supabase/functions/ai-prepare/index.ts`
- Modify: `apprentice-atlas/supabase/config.toml`
- Test: `apprentice-atlas/tests/ai-prepare.test.ts`
- Test: `apprentice-atlas/tests/prompt-schema.test.ts`
- Test: `apprentice-atlas/tests/auth-ui.test.ts`

### Step 1: Write failing contract tests

Require 3–5 interview questions with `question`, `whyAsked`, and `answerTip`; skill-gap output with grounded matches, learnable gaps, and honest positioning tips. Reject oversized background text, invalid UUID/language, unauthenticated calls, malformed model output, and inactive jobs not owned through a favorite/application.

### Step 2: Verify failure

Run: `npm test -- tests/ai-prepare.test.ts tests/prompt-schema.test.ts tests/auth-ui.test.ts`
Expected: FAIL on missing contracts and route.

### Step 3: Implement the Edge Function

Authenticate the bearer token, fetch the canonical job server-side, and permit inactive jobs only when the user has a favorite or tracked application. Treat user background as untrusted quoted data. Call the Responses API with `store: false`, strict JSON schema, `gpt-5.6`, bounded output, and the existing error envelope. Never write personal background or output into shared `job_ai_content`.

### Step 4: Implement the native preparation experience

Create a focused authenticated screen with:
- a concise editable background/skills field saved locally;
- one generate action;
- interview question cards with rationale and answer coaching;
- clear `Already strong`, `Build next`, and `How to position it` sections;
- explicit uncertainty language and no claim that the analysis determines eligibility.

Add a prominent `Prepare` action on job detail. Route the Atlas `prepare-interview` next action directly to this screen. Preserve a safe auth return path.

### Step 5: Verify and commit

Run: `npm test -- tests/ai-prepare.test.ts tests/prompt-schema.test.ts tests/auth-ui.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

Commit: `feat: add job-specific AI preparation`

## Task 3: Tracker delight, interview dates, reminders, and calendar actions

**Files:**
- Modify: `apprentice-atlas/src/types/jobs.ts`
- Modify: `apprentice-atlas/src/lib/application-flow.ts`
- Modify: `apprentice-atlas/src/lib/applications.ts`
- Modify: `apprentice-atlas/src/lib/favorites.ts`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Modify: `apprentice-atlas/src/app/application/[jobId].tsx`
- Modify: `apprentice-atlas/src/app/job/[id].tsx`
- Modify: `apprentice-atlas/src/app/(tabs)/atlas.tsx`
- Modify: `apprentice-atlas/src/app/(tabs)/favorites.tsx`
- Create: `apprentice-atlas/supabase/migrations/20260715200000_application_interview_date.sql`
- Test: `apprentice-atlas/tests/application-tools.test.ts`
- Test: `apprentice-atlas/tests/applications.test.ts`
- Test: `apprentice-atlas/tests/application-permissions.test.ts`

### Step 1: Write failing behavior and permission tests

Cover `interview_at` mapping/RPC validation; reminder scheduling only while a listing is saved and status is before `applied`; cancellation on unsave or applied/interview/offer/closed; Offer transition review policy; and native event payloads for deadlines/interviews.

### Step 2: Verify failure

Run: `npm test -- tests/application-tools.test.ts tests/applications.test.ts tests/application-permissions.test.ts`
Expected: FAIL.

### Step 3: Extend the private tracker schema

Add nullable `interview_at timestamptz`, update the validated owner-scoped RPC without widening grants, and retain RLS/delete behavior. The field belongs only to authenticated applications.

### Step 4: Implement native tracker interactions

- Add subtle selection haptics when choosing a stage and success/error feedback after persistence.
- Animate the changed journey stage with restrained Reanimated transitions.
- When status becomes Interview, offer an optional native date/time picker and `Add interview to calendar` action.
- On the first successful transition to Offer, delay briefly and request Apple's standard StoreKit review prompt if eligible.
- When a job is saved and has a future official deadline, schedule a local notification three days before it; cancel it after unsave or application.
- Show deadline/reminder state on Saved and job detail surfaces without blocking save when permission is denied.

### Step 5: Verify and commit

Run: `npm test -- tests/application-tools.test.ts tests/applications.test.ts tests/application-permissions.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

Commit: `feat: add tracker milestones and deadline tools`

## Task 4: PDF export, story share cards, privacy copy, and release verification

**Files:**
- Modify: `apprentice-atlas/src/lib/account.ts`
- Modify: `apprentice-atlas/src/lib/legal.ts`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Modify: `apprentice-atlas/src/app/settings.tsx`
- Modify: `apprentice-atlas/src/app/job/[id].tsx`
- Modify: `apprentice-atlas/src/app/_layout.tsx`
- Create: `apprentice-atlas/src/lib/job-sharing.ts`
- Create: `apprentice-atlas/src/components/jobs/job-share-card.tsx`
- Create: `apprentice-atlas/src/app/share/[jobId].tsx`
- Modify: `apprentice-atlas/README.md`
- Test: `apprentice-atlas/tests/account-pdf.test.ts`
- Test: `apprentice-atlas/tests/job-sharing.test.ts`
- Test: `apprentice-atlas/tests/app-store-readiness.test.ts`

### Step 1: Write failing export/share tests

Require HTML escaping, high-contrast A4 output, notes/status/interview dates without full scraped descriptions, deterministic localized share copy, and safe `apprenticeatlas://job/<uuid>` links. Assert legal copy explains AI preparation, device-local notification/profile state, calendar handoff, and generated share assets.

### Step 2: Verify failure

Run: `npm test -- tests/account-pdf.test.ts tests/job-sharing.test.ts tests/app-store-readiness.test.ts`
Expected: FAIL.

### Step 3: Implement human-readable PDF export

Keep JSON export intact. Generate a minimal escaped HTML report from the existing account export, convert it to a cached PDF with Expo Print, and open the native share sheet through Expo Sharing. Provide an honest web fallback.

### Step 4: Implement story-ready sharing

Add a native share preview with a deliberate 9:16 card, strong Apprentice Atlas typography, title/company/location/source attribution, and visible app deep link. Capture at controlled pixel dimensions and share the PNG through the system share sheet. Keep the existing plain-text share fallback where file sharing is unavailable.

### Step 5: Complete policy/docs and full verification

Update settings/legal copy and README. Run:
- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npx expo install --check`
- `npx expo config --type public`
- `npm ci --include=dev`

Expected: all checks pass; no secret is embedded in the client config; native permissions match actual behavior.

Commit: `feat: add portable exports and social sharing`

## Task 5: Supabase deployment, final review, and merge

**Files:**
- Verify all files touched above.

### Step 1: Deploy backend changes

Apply the `application_interview_date` migration through the configured Supabase project, deploy `ai-prepare`, set `verify_jwt = true`, and confirm existing `OPENAI_API_KEY` / model secrets remain server-side.

### Step 2: Run Supabase advisors

Run security and performance advisors. Resolve any new warning caused by this feature set; document unrelated pre-existing warnings.

### Step 3: Fresh final code review

Review the complete diff against this plan, Apple review requirements, privacy boundaries, native permission behavior, accessibility, DE/EN parity, and regression risk. Fix all blocking findings and rerun the complete verification suite.

### Step 4: Merge locally to main

Merge `codex/prepare-progress-tools` into `main` only after the branch is clean and all automated checks pass. Do not start an EAS or local iOS build; the user will create and install the new iOS development build on the physical iPhone.

