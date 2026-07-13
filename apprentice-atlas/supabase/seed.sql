-- LOCAL DEVELOPMENT FIXTURES ONLY.
-- These records are fictional and are not production data or verified vacancies.
-- Production ingestion must use trusted official-source adapters/functions.

insert into public.jobs (
  id, title, company, country, city, latitude, longitude, job_type, level,
  category, tags, raw_description, requirements, source_url, source_name,
  status, last_seen_at, expires_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'IT Specialist Apprenticeship - Application Development',
    'Northstar Digital GmbH', 'Germany', 'Berlin', 52.5200, 13.4050,
    'apprenticeship', 'entry', 'technology',
    array['software', 'web', 'dual-training'],
    'LOCAL FIXTURE: Learn software development in a three-year dual training programme with a small product team.',
    array['Secondary school qualification', 'Interest in programming', 'German B2 or better'],
    'https://example.com/official-fixture/northstar-it-apprenticeship',
    'Local Official-Source Fixture', 'active', '2026-07-12T09:00:00Z', '2026-10-31T23:59:59Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Électricien en alternance / Electrical Technician Apprentice',
    'Atelier Lumière SAS', 'France', 'Lyon', 45.7640, 4.8357,
    'apprenticeship', 'entry', 'skilled-trades',
    array['electrical', 'maintenance', 'hands-on'],
    'LOCAL FIXTURE: Support installation and maintenance work while completing a certified electrical technician programme.',
    array['Motivation for practical work', 'Basic mathematics', 'French B1 or better'],
    'https://example.com/official-fixture/atelier-lumiere-electrician',
    'Local Official-Source Fixture', 'active', '2026-07-11T14:30:00Z', '2026-09-30T23:59:59Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'Kaufmann/Kauffrau für Büromanagement',
    'Rheinland Mobility AG', 'Germany', 'Cologne', 50.9375, 6.9603,
    'apprenticeship', 'entry', 'business',
    array['office', 'customer-service', 'organisation'],
    'LOCAL FIXTURE: Join a mobility services team and learn scheduling, customer communication, and office administration.',
    array['Friendly communication', 'Reliable organisation', 'German B2 or better'],
    'https://example.com/official-fixture/rheinland-office-management',
    'Local Official-Source Fixture', 'active', '2026-07-10T08:15:00Z', '2026-11-15T23:59:59Z'
  );

insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload)
values
  ('11111111-1111-4111-8111-111111111111', 'local_official_fixture', 'fixture-de-berlin-001', 'https://example.com/official-fixture/northstar-it-apprenticeship', '{"fixture":true,"provider":"official-board-shaped-fixture","external_id":"fixture-de-berlin-001","location":{"city":"Berlin","country":"Germany"},"publication_status":"published"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'local_official_fixture', 'fixture-fr-lyon-001', 'https://example.com/official-fixture/atelier-lumiere-electrician', '{"fixture":true,"provider":"official-board-shaped-fixture","external_id":"fixture-fr-lyon-001","location":{"city":"Lyon","country":"France"},"publication_status":"published"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'local_official_fixture', 'fixture-de-cologne-001', 'https://example.com/official-fixture/rheinland-office-management', '{"fixture":true,"provider":"official-board-shaped-fixture","external_id":"fixture-de-cologne-001","location":{"city":"Cologne","country":"Germany"},"publication_status":"published"}'::jsonb);

insert into public.job_translations (job_id, language_code, title, company, description, requirements, tags, status, published_at)
values
  ('11111111-1111-4111-8111-111111111111', 'de', 'Ausbildung Fachinformatiker/in - Anwendungsentwicklung', 'Northstar Digital GmbH', 'LOKALE FIXTUR: Lerne in einem dreijährigen dualen Programm Softwareentwicklung in einem kleinen Produktteam.', array['Mittlerer Schulabschluss', 'Interesse an Programmierung', 'Deutsch mindestens B2'], array['Software', 'Web', 'Duale Ausbildung'], 'published', '2026-07-01T09:00:00Z'),
  ('11111111-1111-4111-8111-111111111111', 'en', 'IT Specialist Apprenticeship - Application Development', 'Northstar Digital GmbH', 'LOCAL FIXTURE: Learn software development in a three-year dual training programme with a small product team.', array['Secondary school qualification', 'Interest in programming', 'German B2 or better'], array['Software', 'Web', 'Dual training'], 'published', '2026-07-01T09:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'de', 'Ausbildung Elektroniker/in im Wechselmodell', 'Atelier Lumière SAS', 'LOKALE FIXTUR: Unterstütze Installations- und Wartungsarbeiten während einer anerkannten Ausbildung im Elektrohandwerk.', array['Freude an praktischer Arbeit', 'Grundkenntnisse Mathematik', 'Französisch mindestens B1'], array['Elektro', 'Wartung', 'Praxis'], 'published', '2026-07-01T09:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'en', 'Electrical Technician Apprentice', 'Atelier Lumière SAS', 'LOCAL FIXTURE: Support installation and maintenance work while completing a certified electrical technician programme.', array['Motivation for practical work', 'Basic mathematics', 'French B1 or better'], array['Electrical', 'Maintenance', 'Hands-on'], 'published', '2026-07-01T09:00:00Z'),
  ('33333333-3333-4333-8333-333333333333', 'de', 'Kaufmann/Kauffrau für Büromanagement', 'Rheinland Mobility AG', 'LOKALE FIXTUR: Lerne Terminplanung, Kundenkommunikation und Büroorganisation in einem Mobilitätsteam.', array['Freundliche Kommunikation', 'Zuverlässige Organisation', 'Deutsch mindestens B2'], array['Büro', 'Kundenservice', 'Organisation'], 'published', '2026-07-01T09:00:00Z'),
  ('33333333-3333-4333-8333-333333333333', 'en', 'Office Management Apprentice', 'Rheinland Mobility AG', 'LOCAL FIXTURE: Join a mobility services team and learn scheduling, customer communication, and office administration.', array['Friendly communication', 'Reliable organisation', 'German B2 or better'], array['Office', 'Customer service', 'Organisation'], 'published', '2026-07-01T09:00:00Z');
