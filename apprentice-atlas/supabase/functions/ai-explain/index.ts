// @ts-ignore Supabase Edge Functions resolve npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createExplainHandler } from './handler.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void } | undefined;
const env = (name: string) => typeof Deno !== 'undefined' ? Deno.env.get(name) ?? '' : '';
export const handleExplainRequest = createExplainHandler({ env, createAdmin: (url, key) => createClient(url, key), fetcher: fetch });
if (typeof Deno !== 'undefined') Deno.serve(handleExplainRequest);
