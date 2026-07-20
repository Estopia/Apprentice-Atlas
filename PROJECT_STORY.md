# Apprentice Atlas — Find Your Future Nearby

## Inspiration

“What am I supposed to do after school?”

It is a dramatic line in our showcase video, but it reflects a real problem. Students are expected to make career decisions before they know which opportunities exist, what unfamiliar job titles mean, or what working in those roles would actually feel like.

Traditional job boards assume that users already know what to search for. Their listings are often written in dense employer language, spread across different services, and designed around filling a vacancy rather than helping a young person understand their options.

We wanted to build something that starts one step earlier.

**Apprentice Atlas helps students and people leaving university without a degree move from uncertainty to one concrete next step.**

Instead of beginning with a perfect job title, users can look at the opportunities around them, understand each role in plain language, assess whether it might fit them, and continue toward an actual application.

## What it does

Apprentice Atlas is a bilingual, map-first mobile app for discovering apprenticeships and early-career opportunities across Germany and the United Kingdom.

Users can:

- Explore official opportunities on a native map or in a searchable list.
- Search by role, company, interest, location, and opportunity type.
- Use their current location or enter a location manually.
- Browse without creating an account.
- Open the original listing and official application source.
- Read a GPT-5.6 explanation written in clear, youth-friendly language.
- See balanced **“Good if you…”** and **“Not so good if you…”** guidance.
- Ask practical questions such as, “What would I actually do during a normal day?”
- Save promising opportunities after signing in.
- Track an application from interest and preparation through interview and offer.
- Add deadlines and interviews to the native calendar.
- Generate job-specific interview questions and a skill-gap analysis.
- Export application progress and account data.
- Use the complete product in English or German.

The experience forms one continuous journey:

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

That journey is what makes Apprentice Atlas different from a map with an AI summary attached. Discovery is only the beginning. The Home screen adapts to the user’s progress, saved opportunities become a shortlist, and My Atlas turns an interesting listing into an actionable application plan.

## How we built it

Apprentice Atlas is a native mobile application built with:

- **Expo SDK 57**
- **React Native and TypeScript**
- **Expo Router**
- **Apple Maps on iOS**
- **Supabase Auth, Postgres, Storage, Row Level Security, RPCs, and Edge Functions**
- **OpenAI Responses API with GPT-5.6**
- **Official German and UK apprenticeship data sources**
- **EAS Build and TestFlight**

German opportunities are collected through Bundesagentur für Arbeit-hosted endpoints. UK opportunities use the official Find an apprenticeship Display Advert API v2. Data ingestion runs server-side and normalizes both providers into one shared job model. We deliberately chose official APIs instead of scraping websites.

Anonymous users receive access only to active public listings. Saved jobs, application states, interview dates, and notes are protected by owner-only Supabase policies. Service-role credentials, provider payloads, synchronization records, and OpenAI credentials never ship in the mobile application.

We created the project during Build Week, beginning with a written product design and implementation plan before building the first vertical slice.

## How GPT-5.6 powers the experience

GPT-5.6 is not a decorative chatbot. It powers several focused product experiences:

- Rewriting dense vacancy text in simple language.
- Generating balanced fit guidance.
- Answering practical questions about a selected role.
- Creating job-specific interview questions.
- Comparing a voluntary user background with the requirements stated in the advert.

Every request is grounded in the canonical job record fetched server-side. Outputs follow validated structured schemas, and the system is instructed to distinguish source facts from interpretation.

When the advert does not contain enough information, the correct answer is not a confident guess—it is an honest unknown.

The original vacancy and official source always remain available. Personal preparation requests use `store: false`, and the editable background draft remains on the user’s device rather than being written to the shared AI cache.

## How we collaborated with Codex

We used Codex throughout the entire project as a persistent, repository-aware product and engineering partner—not as a one-shot prototype generator.

Our workflow was:

1. Define a product decision and its boundaries.
2. Convert it into acceptance criteria and a testable specification.
3. Implement a focused vertical slice with Codex.
4. Test it in the browser and on a physical iPhone.
5. Review the real result and provide direct product feedback.
6. Iterate, add regression coverage, and review again.

Codex accelerated work across the full stack:

- Translating product discussions into typed contracts, API boundaries, migrations, and implementation plans.
- Building Expo Router screens, native navigation, bilingual onboarding, authentication, map discovery, and application tracking.
- Implementing Supabase Edge Functions, database policies, source adapters, structured AI outputs, and server-side safeguards.
- Creating regression tests for authentication, RLS ownership, source normalization, ranking, navigation, application states, native fallbacks, and accessibility.
- Diagnosing EAS dependency failures, an iOS launch crash, missing Production environment variables, and a malformed Supabase key in a TestFlight build.
- Iterating on screens that initially felt sparse, text-heavy, generic, or too similar to a responsive web app.

The product decisions remained human-led. We chose the audience, countries, official-data-only approach, bilingual experience, anonymous browsing boundary, optional location, dedicated Map tab, adaptive Home screen, and the requirement that AI admit uncertainty.

Codex made those decisions dramatically faster to implement, inspect, test, and refine. The commit history documents that collaboration from the initial specification to a working TestFlight build.

The final repository passes **362 automated tests**, alongside TypeScript, Expo lint, Expo Doctor, static export checks, database permission tests, and physical-device verification.

## Challenges we faced

### Making different official APIs feel like one product

The German and UK sources expose different fields, identifiers, location formats, detail structures, and update behavior. We built bounded server-side adapters and a normalized schema while preserving original source attribution and application links.

### Grounding AI without making it feel robotic

A useful explanation must be easier to understand than the source while remaining faithful to it. We designed strict output schemas and prompts that allow interpretation but prohibit invented qualifications, working conditions, or employer promises.

### Building a real mobile experience

Our early interface worked, but it felt closer to a web application than a finished native product. Testing on a physical iPhone exposed issues that browser testing could not: navigation labels, native module compatibility, map sensitivity, sheet layouts, safe areas, calendar behavior, and launch readiness.

We repeatedly rebuilt the visual hierarchy and interaction patterns instead of accepting the first functional version.

### Shipping through EAS and TestFlight

We encountered an out-of-sync npm lockfile, native framework compatibility issues, a launch-time crash, and a Production build with an incorrectly stored Supabase environment value. Codex helped trace each symptom to its actual cause, verify the fix, and add safeguards where appropriate.

These problems reinforced an important lesson: a successful cloud build does not prove that a mobile product works. The final test must happen in the real distribution environment.

## What we learned

We learned that AI is most valuable when it reduces uncertainty at a specific moment—not when it is added everywhere.

A teenager does not need an unrestricted career chatbot. They need answers grounded in the opportunity currently in front of them:

- What would I do?
- Could this suit me?
- What do I need to learn?
- What should I do next?

We also learned that product quality comes from the loop between implementation and critique. Codex could generate a working screen quickly, but physical-device testing and direct design feedback determined whether that screen felt trustworthy, understandable, and genuinely native.

Finally, we learned that official data, responsible AI boundaries, privacy, and polished UX are not separate concerns. Together, they determine whether a young person can confidently act on the information presented.

## What is next

Apprentice Atlas will continue beyond Build Week.

Our next priorities are broader official-source coverage, deeper regional partnerships, stronger accessibility, more personalized pathways, and collaboration with schools, training providers, public institutions, and youth organizations in Germany and the United Kingdom.

The long-term goal is simple:

**No young person should need to know the name of their future career before they are able to discover it.**
