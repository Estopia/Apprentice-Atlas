import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TASK3_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
let hasPsql = true;
try {
  execFileSync('psql', ['--version'], { stdio: 'ignore' });
} catch {
  hasPsql = false;
}

const userOne = '10000000-0000-4000-8000-000000000001';
const userTwo = '10000000-0000-4000-8000-000000000002';
const activeJob = '20000000-0000-4000-8000-000000000001';
const expiredJob = '20000000-0000-4000-8000-000000000002';
const invalidJob = '20000000-0000-4000-8000-000000000003';
const timeExpiredJob = '20000000-0000-4000-8000-000000000004';

const sql = `
begin;

insert into auth.users (id)
values
  ('${userOne}'),
  ('${userTwo}');

insert into public.jobs (id, title, company, country, city, job_type, level, category, raw_description, requirements, source_url, source_name, status, last_seen_at, expires_at, created_at, updated_at)
values
  ('${activeJob}', 'Active tracker job', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry', 'general', '', '{}', 'https://example.test/tracker-active', 'test', 'active', now(), null, now(), now()),
  ('${expiredJob}', 'Expired tracker job', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry', 'general', '', '{}', 'https://example.test/tracker-expired', 'test', 'expired', now(), null, now(), now()),
  ('${invalidJob}', 'Invalid tracker job', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry', 'general', '', '{}', 'https://example.test/tracker-invalid', 'test', 'invalid', now(), null, now(), now()),
  ('${timeExpiredJob}', 'Time expired tracker job', 'Atlas', 'GB', 'London', 'apprenticeship', 'entry', 'general', '', '{}', 'https://example.test/tracker-time-expired', 'test', 'active', now(), now() - interval '1 hour', now(), now());

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '${userOne}', true); end $$;
select status from public.upsert_application('${activeJob}', 'applied', 'First application');

do $$
begin
  begin
    update public.applications
    set job_id = '${expiredJob}'
    where user_id = '${userOne}' and job_id = '${activeJob}';
    raise exception 'job_id was directly mutable';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    perform public.upsert_application('${expiredJob}', 'interested', null);
    raise exception 'expired job was accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.upsert_application('${invalidJob}', 'interested', null);
    raise exception 'invalid job was accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.upsert_application('${timeExpiredJob}', 'interested', null);
    raise exception 'time-expired job was accepted';
  exception when sqlstate 'P0002' then null;
  end;
end;
$$;

reset role;
update public.jobs set status = 'expired' where id = '${activeJob}';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', '${userOne}', true); end $$;
select status from public.upsert_application('${activeJob}', 'interview', 'Still editable');

do $$ begin perform set_config('request.jwt.claim.sub', '${userTwo}', true); end $$;
do $$
declare
  changed integer;
begin
  update public.applications set note = 'hacked' where user_id = '${userOne}';
  get diagnostics changed = row_count;
  if changed <> 0 then
    raise exception 'another user application was updated';
  end if;
end;
$$;

reset role;
select json_build_object(
  'count', count(*),
  'status', max(status),
  'note', max(note)
)::text
from public.applications
where user_id = '${userOne}' and job_id = '${activeJob}';

rollback;
`;

describe('upsert_application PostgreSQL integration', () => {
  it.skipIf(!databaseUrl || !hasPsql)('rejects unavailable jobs, preserves history, and isolates owners', () => {
    const output = execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', databaseUrl!], {
      input: sql,
      encoding: 'utf8',
    }).trim().split('\n');

    expect(output.at(-3)).toBe('applied');
    expect(output.at(-2)).toBe('interview');
    expect(JSON.parse(output.at(-1)!)).toEqual({ count: 1, status: 'interview', note: 'Still editable' });
  });
});
