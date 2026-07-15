# Adaptive Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map-first root with an adaptive native home, move discovery to a dedicated map tab, and add a focused local search flow.

**Architecture:** Keep Supabase APIs unchanged. Add pure deterministic home-presentation helpers and an AsyncStorage-backed recent-search module, then compose existing jobs, favorites, applications, preferences, and discovery state in the new home route. Preserve the existing discovery implementation as the map tab and use shared discovery state plus a route view parameter for search handoff.

**Tech Stack:** Expo Router, React Native, NativeTabs, AsyncStorage, Supabase client, Vitest, TypeScript.

---

### Task 1: Home domain logic and recent searches

**Files:**
- Create: `apprentice-atlas/src/lib/home-presentation.ts`
- Create: `apprentice-atlas/src/lib/recent-searches.ts`
- Create: `apprentice-atlas/tests/home-presentation.test.ts`
- Create: `apprentice-atlas/tests/recent-searches.test.ts`

- [ ] Write failing tests for recommendation eligibility, the fixed interest/distance/freshness score, deterministic ordering, six-item limit, fallback fill, upcoming-deadline selection, and adaptive section state.
- [ ] Run `npx vitest run tests/home-presentation.test.ts tests/recent-searches.test.ts` and confirm the new modules are missing.
- [ ] Implement pure helpers that hard-filter active country jobs, exclude saved/tracked IDs, score interest `+4`, distance `+3/+2/+1` at 25/50/100 km, score freshness `+2/+1` at 7/30 days, and use updated time then ID as tie-breakers.
- [ ] Implement local recent-search loading, save, and clear with trim, whitespace normalization, 100-character cap, case-insensitive dedupe, newest-first ordering, and a five-item limit.
- [ ] Re-run the focused tests and commit the passing task.

### Task 2: Map tab and focused search route

**Files:**
- Create: `apprentice-atlas/src/app/(tabs)/map.tsx`
- Create: `apprentice-atlas/src/app/search.tsx`
- Modify: `apprentice-atlas/src/components/app-tabs.tsx`
- Modify: `apprentice-atlas/src/app/_layout.tsx`
- Modify: `apprentice-atlas/src/lib/auth.ts`
- Modify: `apprentice-atlas/src/lib/onboarding-destination.ts`
- Test: `apprentice-atlas/tests/home-navigation.test.ts`

- [ ] Write failing source-contract and pure-navigation tests for four native tabs, safe `/map` and `/search` returns, and search handoff to map list mode.
- [ ] Move the current discovery component unchanged into `map.tsx`, add `view=list|map` route handling, and leave `/explore` as a redirect to `/map`.
- [ ] Build the search screen with autofocus, cancel, local recent searches, clear action, onboarding-interest chips, country/filter shortcuts, and submission that updates discovery filters before navigating to `/map?view=list`.
- [ ] Register the search route and update safe return/onboarding destinations without broadening arbitrary redirects.
- [ ] Run the focused tests and commit the passing task.

### Task 3: Adaptive native home

**Files:**
- Replace: `apprentice-atlas/src/app/(tabs)/index.tsx`
- Create: `apprentice-atlas/src/components/home/home-job-card.tsx`
- Modify: `apprentice-atlas/src/lib/i18n.ts`
- Test: `apprentice-atlas/tests/home-presentation.test.ts`
- Test: `apprentice-atlas/tests/accessibility-hit-areas.test.ts`

- [ ] Add failing presentation/source tests for signed-out, no-application, active-application, nearby/no-location, deadline, loading, error, and empty states in both locales.
- [ ] Compose jobs for the selected country with authenticated favorites/applications loaded in parallel and independently retryable section state.
- [ ] Build the native scroll hierarchy: title/settings, pressable search surface, conditional blue next-action hero, horizontally snapping recommendation cards, nearby map row, and conditional upcoming deadlines.
- [ ] Keep cards image-free and grounded in official data; use category symbols, continuous corners, minimum 44-point targets, Dynamic Type-safe wrapping, and reduced-motion-safe transitions.
- [ ] Add pull-to-refresh and contextual navigation to job, application, preparation, search, settings, and map routes.
- [ ] Run focused tests and commit the passing task.

### Task 4: Integration and release verification

**Files:**
- Modify only files required by failing checks.

- [ ] Run `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`, `npx expo export --platform web`, and `npm ci --include=dev --dry-run`.
- [ ] Verify no unrequested dependency, Supabase schema, or native configuration changes were introduced.
- [ ] Review the complete diff against the approved Home, Map, Saved, Atlas hierarchy and fix all spec or quality gaps.
- [ ] Commit the verified implementation, merge it into `main`, push `main`, and remove the temporary worktree.
