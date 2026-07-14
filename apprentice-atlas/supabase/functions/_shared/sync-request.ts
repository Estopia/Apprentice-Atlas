export interface SyncRequestBody {
  provider?: 'find-apprenticeship' | 'bundesagentur-fuer-arbeit';
}

export interface ParsedSyncRequest {
  body: SyncRequestBody;
  error?: undefined;
}

export interface InvalidSyncRequest {
  body?: undefined;
  error: { code: 'INVALID_JSON'; message: string };
}

export async function parseSyncRequest(request: Request): Promise<ParsedSyncRequest | InvalidSyncRequest> {
  const text = await request.text();
  if (text.length === 0) return { body: {} };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON body must be an object');
    return { body: parsed as SyncRequestBody };
  } catch (error) {
    return { error: { code: 'INVALID_JSON', message: error instanceof Error ? error.message : 'Request body is not valid JSON' } };
  }
}
