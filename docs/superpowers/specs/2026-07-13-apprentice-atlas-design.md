# Apprentice Atlas — Product and Technical Design

## Product goal

Apprentice Atlas helps school students and university dropouts in Germany and the United Kingdom discover apprenticeships and entry-level jobs nearby, understand them in simple language, save them, compare them, and open the original application listing.

The app supports German and English. Browsing and job details work without an account; login is required for favorites and comparison.

## MVP user stories

1. A user can discover nearby jobs on a map using device location or a manually selected city and country.
2. A user can open a job and read a localized GPT-5.6 explanation, including “Good if you…” and “Not so good if you…” lists.
3. A user can ask up to two questions about a job and receive a concise, source-grounded answer.
4. An authenticated user can save jobs and compare saved opportunities.
5. A user can open the official source listing to continue researching or applying.

## Architecture

The mobile client is built with Expo, React Native, and TypeScript. Supabase provides authentication, PostgreSQL, row-level security, and Edge Functions. Official job APIs are fetched server-side, normalized into the Supabase database, and exposed to the client through Supabase queries or a thin application API. GPT-5.6 is called only from Edge Functions; the API key is never shipped in the mobile app.

```text
Expo / React Native
  ├── Map, filters, job details, favorites, auth, localization
  └── Supabase client
        ├── Supabase Auth
        ├── PostgreSQL + RLS
        └── Edge Functions
              ├── Official API synchronization
              └── GPT-5.6 explanation and Q&A
```

## Data and synchronization

Core tables:

- `jobs`: normalized title, company, country, city, coordinates, type, level, category, tags, requirements, raw description, source URL, status, and timestamps.
- `job_sources`: provider, external job ID, source URL, raw-data reference, and synchronization metadata.
- `sync_runs`: synchronization start/end, counts, and errors.
- `job_translations`: German and English localized job content where available.
- `favorites`: `(user_id, job_id)` with RLS so users can access only their own records.
- `job_ai_content`: cached, localized GPT-5.6 summaries and fit lists.

The initial data must come from official APIs, not invented demo jobs or HTML scraping. The UK source is the official Find an apprenticeship Display Advert API. The German source is intended to be the Bundesagentur für Arbeit API, pending confirmation of the official read access and usage terms. If an official source cannot be used, it is not silently replaced with scraping.

## AI behavior

GPT-5.6 receives only normalized job data and the user question. Prompts require JSON output, the requested language, simple wording, and explicit disclosure when information is missing. The model must not invent salary, working hours, benefits, company culture, qualifications, or guarantees. Explanations and fit lists are cached per job and language; Q&A is limited to two questions per job and session.

## Authentication and user flow

Unauthenticated users can choose a location, browse the map, open job details, and use the explanation/Q&A features. Saving a job triggers the Supabase login or registration flow. Authenticated users can manage favorites and compare them.

## Localization

The UI and AI output support `de` and `en`. The selected language is stored as a user preference where available. Company names and official job titles should not be translated unnecessarily.

## Delivery priorities

Must-have: official API ingestion, map and filters, job details, GPT-5.6 explanation and Q&A, localization, auth-gated favorites, comparison, external source links, robust loading/error states, and tests for core flows.

Nice-to-have: personalized recommendations, notifications, sharing, application checklists, and additional official sources.

## Demo concept

The demo is an English comedy skit rather than a traditional pitch. A student shouts, “WHAT AM I SUPPOSED TO DO AFTER SCHOOL?!”, God appears and recommends Apprentice Atlas, and the student narrates a screen recording while discovering, understanding, questioning, and saving a job. The final joke connects the build process to Codex: “No. That’s what Codex is for.”

## Codex and GPT-5.6 documentation

The README should explain that Codex was used as an engineering and review partner for Expo components, Supabase queries and Edge Functions, typed clients, API adapters, validation, tests, and documentation. It should separately describe GPT-5.6 as the user-facing system for plain-language explanations, fit lists, and limited job Q&A.
