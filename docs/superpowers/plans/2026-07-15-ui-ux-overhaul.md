# Apprentice Atlas UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing functional Apprentice Atlas app into a coherent native mobile product by fixing visible data inconsistencies, simplifying discovery and detail hierarchy, and completing saved, application, authentication, onboarding, and accessibility states.

**Architecture:** Keep Expo Router, React Native, NativeTabs, Supabase, and the existing data layer. Add small pure presentation helpers for job taxonomy and description cleanup, then refactor screens in place without changing backend contracts. Native iOS/Android behavior remains primary; web remains the visual smoke-test surface.

**Tech Stack:** Expo 57, React Native, Expo Router, TypeScript, Vitest, Supabase.

## Global Constraints

- Preserve browsing without login; saving and application tracking require login.
- Preserve German and English localization and Germany/United Kingdom search.
- Use white backgrounds, navy text, and `#155EEF` as the only primary accent.
- Preserve official Sign in with Apple UI; do not add Google sign-in.
- Do not run an iOS simulator or local native build; validate with tests, lint, TypeScript, and Expo web.
- Keep native tabs, native stack headers, and form sheets.
- New behavior must follow test-first red-green-refactor.

---

### Task 1: Normalize job presentation data

**Files:**
- Create: `apprentice-atlas/src/lib/job-presentation.ts`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Modify: `apprentice-atlas/src/app/filters.tsx`
- Test: `apprentice-atlas/tests/job-presentation.test.ts`

**Interfaces:**
- Produces `normalizeJobLevel(level): 'entry-level' | 'intermediate' | 'unknown'`.
- Produces `cleanJobDescription(raw): string` for removing visible Markdown markers while retaining paragraph structure.
- Produces localized `localizeJobLevel` behavior for API values including `entry`, `entry-level`, and unknown values.

- [x] Write failing tests proving `entry` and `entry-level` map to the same localized beginner label, unknown levels do not leak raw machine values, and common Markdown bold/list markers are cleaned.
- [x] Run `npm test -- tests/job-presentation.test.ts tests/i18n.test.ts` and confirm the new assertions fail for the missing helper/current mappings.
- [x] Implement the pure presentation helpers, update the filter to emit `entry-level`, and route level localization through the normalized value.
- [x] Run the focused tests and the full suite.
- [x] Commit as `fix: normalize job presentation data`.

### Task 2: Simplify discovery and rebuild job detail hierarchy

**Files:**
- Modify: `apprentice-atlas/src/app/(tabs)/index.tsx`
- Modify: `apprentice-atlas/src/components/jobs/job-card.tsx`
- Modify: `apprentice-atlas/src/components/map/job-map.tsx`
- Modify: `apprentice-atlas/src/app/job/[id].tsx`
- Modify: `apprentice-atlas/src/components/jobs/ai-explanation.tsx`
- Modify: `apprentice-atlas/src/components/jobs/job-qa.tsx`
- Test: `apprentice-atlas/tests/discovery-presentation.test.ts`
- Test: `apprentice-atlas/tests/job-presentation.test.ts`

**Interfaces:**
- Consumes `cleanJobDescription` and normalized localization from Task 1.
- Preserves existing job/favorite/application APIs and route contracts.

- [x] Write failing presentation tests for compact map-control labels, localized location context, cleaned descriptions, and stable camera-update decisions.
- [x] Run focused tests and confirm expected failures.
- [x] Reduce map chrome, compact the selected-job preview, retain clustering/search-area behavior, and prevent result refreshes from unnecessarily recentering the map.
- [x] Use an opaque/native-safe detail header, add a concise at-a-glance block, keep AI explanation before the original listing, collapse long original descriptions behind progressive disclosure, move Q&A ahead of the raw listing, and preserve sticky Save/Apply actions.
- [x] Increase essential metadata sizes and minimum touch targets to 44 points.
- [x] Run focused tests, full tests, lint, and TypeScript.
- [x] Commit as `feat: refine discovery and job details`.

### Task 3: Complete filters, saved jobs, and Atlas information architecture

**Files:**
- Modify: `apprentice-atlas/src/app/filters.tsx`
- Modify: `apprentice-atlas/src/app/(tabs)/favorites.tsx`
- Modify: `apprentice-atlas/src/app/(tabs)/atlas.tsx`
- Modify: `apprentice-atlas/src/app/application/[jobId].tsx`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Test: `apprentice-atlas/tests/atlas-quality.test.ts`
- Test: `apprentice-atlas/tests/discovery-state.test.ts`

**Interfaces:**
- Preserves discovery-state, favorite, and application persistence APIs.
- Moves language/account ownership to Atlas while Saved becomes opportunity-only.

- [x] Write failing tests for active filter summaries/results CTA copy, Atlas next-action derivation, and complete localized copy.
- [x] Run focused tests and confirm failures.
- [x] Compress filter groups, remove language from discovery filters, show active-filter summary and a result-oriented sticky action, and make reset visually neutral.
- [x] Ensure Saved always has a title, remove duplicate account/sign-out UI, improve signed-out and empty states, and keep populated rows compact and scannable.
- [x] Reorder Atlas around the user's next action and active applications; place metrics, preferences, and account lower in the hierarchy.
- [x] Simplify application status editing into a native, readable journey while preserving all statuses and notes.
- [x] Run focused tests, full tests, lint, and TypeScript.
- [x] Commit as `feat: complete saved and atlas journeys`.

### Task 4: Polish onboarding, authentication, responsive behavior, and accessibility

**Files:**
- Modify: `apprentice-atlas/src/app/onboarding.tsx`
- Modify: `apprentice-atlas/src/app/auth.tsx`
- Modify: `apprentice-atlas/src/components/auth/auth-form.tsx`
- Modify: `apprentice-atlas/src/constants/theme.ts`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Test: `apprentice-atlas/tests/auth-ui.test.ts`
- Test: `apprentice-atlas/tests/accessibility-hit-areas.test.ts`
- Test: `apprentice-atlas/tests/i18n.test.ts`

**Interfaces:**
- Preserves magic-link and Apple-auth service contracts.
- Adds pure email validity state used by the auth UI.

- [x] Write failing tests for blank/invalid email submission state, one-close-control platform behavior, minimum touch sizes, and copy completeness.
- [x] Run focused tests and confirm failures.
- [x] Make authentication full-bleed and native, remove duplicate non-iOS chrome, validate email before enabling submission, and retain the official Apple button unchanged.
- [x] Rework onboarding to a flex layout with a stable footer and scrolling only when content truly overflows; simplify audience choices and reduce card/shadow repetition.
- [x] Normalize type sizes, touch targets, disabled states, and light-only theme intent across touched screens.
- [x] Run all tests, lint, TypeScript, and Expo web visual smoke tests at 390x844 and 430x932.
- [x] Commit as `feat: polish onboarding auth and accessibility`.

### Task 5: Final integration review and merge

**Files:**
- Review all files changed by Tasks 1-4.

**Interfaces:**
- Produces a verified feature branch ready to merge into `main`.

- [x] Run `npm test`, `npm run lint`, and `npx tsc --noEmit` from `apprentice-atlas`.
- [x] Run `npx expo start --web --port 8092` and visually verify onboarding, map/list discovery, filters, detail, signed-out Saved, signed-out Atlas, and Auth at mobile viewports.
- [x] Request final spec and code-quality review; resolve all critical and important findings.
- [ ] Merge `codex/ui-ux-overhaul` into `main` locally.
- [ ] Re-run the full verification suite on merged `main` and remove the owned worktree/branch.
