-- Enforce official listing URLs for all new writes while leaving legacy rows
-- readable until they are repaired. NOT VALID checks still apply to inserts
-- and updates; validation is intentionally deferred for existing data.
alter table public.jobs
  add constraint jobs_source_url_http_check
  check (
    source_url is not null
    and source_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    and nullif(split_part(split_part(split_part(source_url, '/', 3), '?', 1), '#', 1), '') is not null
  )
  not valid;

alter table public.job_sources
  add constraint job_sources_source_url_http_check
  check (
    source_url is not null
    and source_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    and nullif(split_part(split_part(split_part(source_url, '/', 3), '?', 1), '#', 1), '') is not null
  )
  not valid;

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
  job_source_url text := nullif(btrim(p_job->>'source_url'), '');
  normalized_source_url text := nullif(btrim(p_source_url), '');
begin
  if normalized_source_url is null
    or normalized_source_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    or nullif(split_part(split_part(split_part(normalized_source_url, '/', 3), '?', 1), '#', 1), '') is null then
    raise exception 'upsert_job_source requires a valid http or https source URL' using errcode = '22023';
  end if;
  if job_source_url is null
    or job_source_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
    or nullif(split_part(split_part(split_part(job_source_url, '/', 3), '?', 1), '#', 1), '') is null then
    raise exception 'upsert_job_source requires job.source_url to be a valid http or https URL' using errcode = '22023';
  end if;
  if job_source_url <> normalized_source_url then
    raise exception 'upsert_job_source source URLs must match' using errcode = '22023';
  end if;

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
      category, tags, raw_description, requirements, source_url, application_url, source_name,
      status, last_seen_at, expires_at, created_at, updated_at
    ) values (
      canonical_job_id,
      p_job->>'title', p_job->>'company', p_job->>'country', p_job->>'city',
      nullif(p_job->>'latitude', '')::double precision, nullif(p_job->>'longitude', '')::double precision,
      p_job->>'job_type', p_job->>'level', p_job->>'category',
      coalesce(array(select jsonb_array_elements_text(p_job->'tags')), '{}'),
      p_job->>'raw_description', coalesce(array(select jsonb_array_elements_text(p_job->'requirements')), '{}'),
      normalized_source_url, nullif(p_job->>'application_url', ''), p_job->>'source_name',
      coalesce(p_job->>'status', 'active'), coalesce(nullif(p_job->>'last_seen_at', '')::timestamptz, p_fetched_at),
      nullif(p_job->>'expires_at', '')::timestamptz, coalesce(nullif(p_job->>'created_at', '')::timestamptz, now()),
      coalesce(nullif(p_job->>'updated_at', '')::timestamptz, p_fetched_at)
    );
  else
    update public.jobs
    set title = p_job->>'title', company = p_job->>'company', country = p_job->>'country', city = p_job->>'city',
        latitude = nullif(p_job->>'latitude', '')::double precision, longitude = nullif(p_job->>'longitude', '')::double precision,
        job_type = p_job->>'job_type', level = p_job->>'level', category = p_job->>'category',
        tags = coalesce(array(select jsonb_array_elements_text(p_job->'tags')), '{}'),
        raw_description = p_job->>'raw_description', requirements = coalesce(array(select jsonb_array_elements_text(p_job->'requirements')), '{}'),
        source_url = normalized_source_url, application_url = nullif(p_job->>'application_url', ''), source_name = p_job->>'source_name',
        status = coalesce(p_job->>'status', 'active'), last_seen_at = coalesce(nullif(p_job->>'last_seen_at', '')::timestamptz, p_fetched_at),
        expires_at = nullif(p_job->>'expires_at', '')::timestamptz, updated_at = coalesce(nullif(p_job->>'updated_at', '')::timestamptz, p_fetched_at)
    where id = canonical_job_id;
  end if;

  if existing_source_id is null then
    insert into public.job_sources (job_id, provider, external_id, source_url, raw_payload, status, fetched_at)
    values (canonical_job_id, p_provider, p_external_id, normalized_source_url, coalesce(p_raw_payload, '{}'::jsonb), 'active', p_fetched_at);
    source_was_inserted := true;
  else
    update public.job_sources
    set job_id = canonical_job_id, source_url = normalized_source_url, raw_payload = coalesce(p_raw_payload, '{}'::jsonb), status = 'active', fetched_at = p_fetched_at
    where id = existing_source_id;
  end if;

  return query select canonical_job_id, source_was_inserted;
end;
$$;

revoke execute on function public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.upsert_job_source(text, text, text, jsonb, jsonb, timestamptz) to service_role;
