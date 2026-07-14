export const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'content-type': 'application/json' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
export const options = () => new Response('ok', { headers: corsHeaders });
export const errorResponse = (code: string, message: string, status: number) => json({ error: { code, message } }, status);
