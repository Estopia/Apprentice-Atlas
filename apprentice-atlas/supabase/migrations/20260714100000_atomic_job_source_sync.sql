-- Atomically claim a provider listing and its canonical job row.
-- The advisory lock closes the no-row race before the unique source insert.
-- Existing jobs are updated without changing created_at.

create or replace function public.upsert_job_source(
  p_provider text,
  p_external_id text,
  p_source_url text,
  p_raw_payload jsonb,
  p_job jsonb,
  p_fetched_at timestamptz
)
returns table(job_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_source_id uuid;
  existing_job_id uuid;
  canonical_job_id uuid;
  source_was_inserted boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_external_id, 0));

  select id, job_sources.job_id
  into existing_source_id, existing_job_id
  from public.job_sources
  where provider = p_provider and external_id = p_external_id
  for update;

  canonical_job_id := coalesce(existing_job_id, (p_job->>'id')::uuid);

  if existing_job_id is null then
    insert into public.jobs (
      id, title, company, country, city, latitude, longitude, job_type, level,
      category, tags, raw_description, requirements, source_url, source_name,
      status, last_seen_at, expires_at, created_at, updated_at
    ) values (
      canonical_job_id,
      p_job->>'title',
      p_job->>'company',
      p_job->>'country',
      p_job->>'city',
      nullif(p_job->>'latitude', '')::double precision,
      nullif(p_job->>'longitude', '')::double precision,
      p_job->>'job_type',
      p_job->>'level',
      p_job->>'category',
      coalesce(array(select jsonb_array_elements_text(p_job->'tags')), '{}'),
      p_job->>'raw_description',
      coalesce(array(select jsonb_array_elements_text(p_job->'requirements')), '{}'),
      p_job->>'source_url',
      p_job->>'source_name',
      coalesce(p_job->>'status', 'active'),
      coalesce(nullif(p_job->>'last_seen_at', '')::timestamptz, p_fetched_at),
      nullif(p_job->>'expires_at', '')::timestamptz,
      coalesce(nullif(p_job->>'created_at', '')::timestamptz, now()),
      coalesce(nullif(p_job->>'updated_at', '')::timestamptz, p_fetched_at)
    );
  else
    update public.jobs
    set title = p_job->>'title',
        company = p_job->>'company',
        country = p_job->>'country',
        city = p_job->>'city',
        latitude = nullif(p_job->>'latitude', '')::double precision,
        longitude = nullif(p_job->>'longitude', '')::double precision,
        job_type = p_job->>'job_type',
        level = p_job->>'level',
        category = p_job->>'category',
        tags = coalesce(array(select jsonb_array_elements_text(p_job->'tags')), '{}'),
        raw_description = p_job->>'raw_description',
        requirements = coalesce(array(select jsonb_array_elements_text(p_job->'requirements')), '{}'),
        source_url = p_job->>'source_url',
        source_name = p_job->>'source_name',
        status = coalesce(p_job->>'status', 'active'),
        last_seen_at = coalesce(nullif(p_job->>'last_seen_at', '')::timestamptz, p_fetched_at),
        expires_at = nullif(p_job->>'expires_at', '')::timestamptz,
        updated_at = coalesce(nullif(p_job->>'updated_at', '')::timestamptz, p_fetched_at)
    where id = canonical_job_id;
  end if;

  if existing_source_id is null then
    insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload, status, fetched_at)
    values (canonical_job_id, p_provider, p_external_id, p_source_url, coalesce(p_raw_payload, '{}'::jsonb), 'active', p_fetched_at);
    source_was_inserted := true;
  else
    update public.job_sources
    set job_id = canonical_job_id,
        source_url = p_source_url,
        raw_payload = coalesce(p_raw_payload, '{}'::jsonb),
        status = 'active',
        fetched_at = p_fetched_at
    where id = existing_source_id;
  end if;

  return query select canonical_job_id, source_was_inserted;
end;
$$;

grant execute on function public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz) to service_role;
