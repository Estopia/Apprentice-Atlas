-- Application destinations are optional, but any stored destination must be a
-- strict absolute HTTP(S) URL. NOT VALID preserves readable legacy rows while
-- enforcing the invariant for new inserts and updates.
alter table public.jobs
  add constraint jobs_application_url_http_check
  check (
    application_url is null
    or (
      application_url ~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$'
      and nullif(split_part(split_part(split_part(application_url, '/', 3), '?', 1), '#', 1), '') is not null
    )
  )
  not valid;
