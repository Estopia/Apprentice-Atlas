// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createDeleteAccountHandler } from './handler.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;
const env = (name: string) => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';

export const handleDeleteAccount = createDeleteAccountHandler({
  env,
  createUserClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  createAdminClient: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
});

if (typeof Deno !== 'undefined') Deno.serve(handleDeleteAccount);
