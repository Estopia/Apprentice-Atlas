# Apprentice Atlas

**Find your future nearby.**

Apprentice Atlas is a bilingual, map-first mobile app that helps students and people leaving university without a degree turn uncertainty about their future into a concrete next step. It combines official apprenticeship listings from Germany and the United Kingdom with grounded GPT-5.6 guidance, native discovery, and a private application journey.

Built for the **Education** category of OpenAI Build Week 2026 with **Codex**, **GPT-5.6**, Expo, React Native, and Supabase.

## OpenAI Build Week submission at a glance

| Requirement | How Apprentice Atlas meets it |
| --- | --- |
| **Meaningful Codex use** | Codex was our repository-aware product and engineering partner from the initial specification through full-stack implementation, native iOS debugging, design iteration, testing, and TestFlight release hardening. The concrete workflow and human decisions are documented below. |
| **Meaningful GPT-5.6 use** | GPT-5.6 powers plain-language vacancy explanations, balanced fit guidance, grounded job Q&A, interview practice, and skill-gap analysis through protected Supabase Edge Functions. It is part of the core user journey rather than a standalone chatbot. |
| **Working, non-trivial product** | The bilingual Expo app combines official German and UK apprenticeship sources, native map discovery, authentication, private saved jobs, application tracking, deadlines, exports, and responsible AI safeguards. It has been exercised through a production TestFlight build on a physical iPhone. |
| **Engineering evidence** | The repository contains the product specification, implementation history, Supabase migrations and policies, Edge Functions, source adapters, structured AI schemas, and **362 passing automated tests**. |

Read the complete [Project Story](PROJECT_STORY.md), or jump directly to [how GPT-5.6 works](#gpt-56-in-the-product) and [how we collaborated with Codex](#how-we-collaborated-with-codex).

## The problem

Young people are often asked to choose a career before they understand what the available roles actually involve. Traditional job boards assume that users already know what to search for, present dense employer language, and stop at the application link.

Apprentice Atlas starts one step earlier: *What opportunities exist around me, what would I actually do there, and what should I do next?*

## What Apprentice Atlas does

- Discovers official apprenticeships and early-career opportunities on a native map or searchable list.
- Supports Germany and the United Kingdom in German and English.
- Uses location when permitted and provides a manual city/country fallback when it is not.
- Rewrites dense vacancy text in clear, youth-friendly language with GPT-5.6.
- Produces balanced **“Good if…”** and **“Not so good if…”** guidance grounded in the listing.
- Answers focused questions about a role without inventing facts the advert does not contain.
- Generates job-specific interview questions and an honest skill-gap view.
- Lets signed-in users save opportunities, track applications, manage interviews and deadlines, and export their progress.
- Keeps browsing open without an account while protecting personal data with authentication and row-level security.

## A complete path, not another job board

```text
Post-school uncertainty
        ↓
Official opportunities nearby
        ↓
Plain-language understanding
        ↓
Honest fit guidance
        ↓
A concrete next action
```

The map creates awareness, but the product does not end at discovery. Home adapts to the user's journey, saved roles become a shortlist, and the application tracker turns an interesting vacancy into an actionable plan.

## GPT-5.6 in the product

GPT-5.6 is a user-facing part of the shipped experience, not a decorative chatbot. The app calls it through protected Supabase Edge Functions using the canonical job record fetched server-side.

| Experience | GPT-5.6 contribution | Product safeguard |
| --- | --- | --- |
| In simple words | Rewrites dense vacancy text for a younger audience. | The original listing and official source remain visible. |
| Good if / Not so good if | Converts stated requirements and conditions into balanced fit guidance. | Structured output is validated and grounded in the advert. |
| Job Q&A | Answers practical questions about duties, requirements, and working life. | The answer explicitly admits when the source does not say. |
| Interview preparation | Creates role-specific practice questions and answer guidance. | The vacancy is fetched server-side and outputs follow a strict schema. |
| Skill-gap view | Compares a short user background with stated requirements. | It distinguishes evidence, learning areas, and positioning advice without inventing qualifications. |

OpenAI credentials never ship in the app. Personal preparation requests use `store: false`; the editable background draft stays on the device and is processed transiently for the requested analysis.

## How we collaborated with Codex

We used Codex as a persistent, repository-aware product and engineering partner from the first specification to physical-iPhone testing. The collaboration followed a repeatable loop:

1. Define the user problem and product boundary.
2. Turn the decision into a small, testable specification.
3. Implement a focused vertical slice with Codex.
4. Test in the browser and on a physical iPhone.
5. Give direct product and visual feedback, then iterate.
6. Run automated checks and independent review passes before merging.

Codex accelerated work across the stack:

- **Specification and architecture:** It translated product discussions into acceptance criteria, typed contracts, migrations, API boundaries, and implementation plans.
- **Native product development:** It implemented and connected Expo Router screens, map/list discovery, bilingual onboarding, authentication, Supabase data flows, and native device features.
- **Debugging:** It traced an EAS dependency failure to an out-of-sync lockfile, investigated a launch-time iOS crash, fixed overly sensitive map refreshes and an empty filter sheet, and helped make native modules reliable in the development client.
- **AI integration:** It built protected Edge Functions, structured-output schemas, grounding rules, quotas, and tests for explanations, Q&A, and preparation.
- **Quality:** It added regression coverage for source normalization, authentication return paths, RLS/RPC ownership, ranking, application states, accessibility, navigation, native fallbacks, and launch readiness.
- **Design iteration:** It used physical-device screenshots and native reference patterns to rebuild screens that initially felt sparse, text-heavy, or too much like a responsive website.

The key product decisions remained human-led: the audience, countries, official-data-only approach, bilingual experience, anonymous browsing boundary, optional location, map-as-a-dedicated-tab structure, and the requirement that AI admit uncertainty all came from deliberate product choices. Codex made those decisions faster to implement and easier to test; it did not replace them.

The commit history preserves that collaboration from the initial Expo project and written design through full-stack implementation, device debugging, UI critique, and release hardening. The more detailed engineering account is available in the [app README](apprentice-atlas/README.md#how-we-built-apprentice-atlas-with-codex-and-gpt-56).

## Architecture

```text
Expo + React Native mobile app
        │
        ├── anonymous discovery and local preferences
        ├── Supabase Auth (magic link and Sign in with Apple)
        └── Supabase Postgres with owner-only RLS
                    │
                    ├── official UK apprenticeship API
                    ├── official Bundesagentur für Arbeit endpoints
                    └── Supabase Edge Functions
                                  │
                                  └── OpenAI Responses API / GPT-5.6
```

The application consumes official job sources through server-side adapters; it does not scrape job websites. Provider payloads, service-role credentials, OpenAI credentials, AI caches, and synchronization records remain server-side.

## Technology

- Expo SDK 57, React Native, Expo Router, and TypeScript
- Native Apple Maps on iOS and React Native Maps
- Supabase Auth, Postgres, Storage, Row Level Security, RPCs, and Edge Functions
- OpenAI Responses API with GPT-5.6 and validated structured outputs
- Official German and UK apprenticeship data sources
- Vitest, Expo lint, TypeScript, Expo Doctor, and static platform exports
- EAS production builds distributed and tested through TestFlight on a physical iPhone

## Verification

The repository currently contains **362 automated tests**, with **7 environment-gated integration tests skipped** in the standard local run. The implemented verification workflow also includes Expo lint, TypeScript, Expo Doctor, static web export, migration/RLS checks, and physical-device testing.

From the application directory:

```sh
cd apprentice-atlas
npm ci
npm test
npm run lint
npx tsc --noEmit
npx expo-doctor
npx expo export --platform web
```

## Run locally

Requirements: Node.js, npm, and a Supabase project or local Supabase stack.

```sh
cd apprentice-atlas
npm ci
cp .env.example .env.local
# Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start --web
```

For native calendar, notification, sharing, StoreKit, map, and haptic behavior, use a fresh EAS development client on a physical device:

```sh
cd apprentice-atlas
npx eas build --platform ios --profile development
npx expo start --dev-client
```

Server-only credentials such as `OPENAI_API_KEY`, source API keys, and `SUPABASE_SERVICE_ROLE_KEY` must be configured as Supabase project secrets. Never expose them as `EXPO_PUBLIC_*` variables.

Full setup, migration order, source configuration, security boundaries, native-build notes, and limitations are documented in the [application README](apprentice-atlas/README.md).

## Repository structure

```text
.
├── README.md                 # Project and Build Week overview
├── PROJECT_STORY.md          # Devpost-ready inspiration, build, and lessons
├── LICENSE                   # PolyForm Noncommercial 1.0.0
└── apprentice-atlas/
    ├── src/                  # Expo application and shared product code
    ├── supabase/             # Migrations, Edge Functions, and local fixtures
    ├── docs/                 # Product design, implementation, and demo notes
    ├── assets/               # App-owned visual and animation assets
    └── README.md             # Detailed engineering and operations guide
```

## Privacy and responsible AI

- Anonymous users can browse without creating an account.
- Favorites and application records are owner-only through Supabase RLS.
- The original vacancy and official source remain available beside AI guidance.
- AI outputs use strict schemas and return an explicit unknown state when evidence is missing.
- Personal preparation text is not stored in the shared job AI cache.
- Calendar entries, local reminders, PDFs, and share cards are created only after a user action.
- Users can export or delete their account data from the app.

## Status and limitations

Apprentice Atlas is a functional Build Week release tested through a production TestFlight build on a physical iPhone. AI availability and live source synchronization depend on correctly configured server-side credentials and network access. The app supports discovery and preparation; final applications are completed on the official provider page.

## License

Copyright © 2026 **Estopia Engineering Ltd**. Apprentice Atlas is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE). Noncommercial use, study, modification, and distribution are permitted under its terms. Commercial use, commercial deployment, and commercial redistribution require a separate written license from Estopia Engineering Ltd.

Third-party packages such as Expo and React Native, official-source content, trademarks, APIs, and provider data are not claimed as property of Estopia Engineering Ltd and remain subject to their respective licenses, terms, and ownership rights.
