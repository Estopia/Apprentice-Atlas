-- Supabase projects may have default privileges that grant broad table access
-- to authenticated when a new public table is created. Reset those defaults,
-- then restore only the operations used by the application tracker.
revoke all on public.applications from authenticated;

grant select, delete on public.applications to authenticated;
grant update (status, note) on public.applications to authenticated;

-- Tracker creation and identity changes remain behind the validated RPC.
revoke insert on public.applications from authenticated;
revoke execute on function public.upsert_application(uuid, text, text) from public;
revoke execute on function public.upsert_application(uuid, text, text) from anon;
grant execute on function public.upsert_application(uuid, text, text) to authenticated;
