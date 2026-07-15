export type StorageEntry = { name: string; id?: string | null; metadata?: Record<string, unknown> | null };
export type DeleteAccountClient = {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string; app_metadata?: Record<string, unknown> } | null }; error: { message?: string } | null }> };
};
export type DeleteAccountAdmin = {
  auth: { admin: { deleteUser(id: string, shouldSoftDelete?: boolean): Promise<{ error: { message?: string } | null }> } };
  storage: { from(bucket: string): {
    list(prefix: string, options: { limit: number; offset: number }): Promise<{ data: StorageEntry[] | null; error: { message?: string } | null }>;
    remove(paths: string[]): Promise<{ error: { message?: string } | null }>;
  } };
};
export type DeleteAccountDeps = {
  env(name: string): string;
  createUserClient(url: string, anonKey: string): DeleteAccountClient;
  createAdminClient(url: string, serviceKey: string): DeleteAccountAdmin;
};

const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });

export function createDeleteAccountHandler(deps: DeleteAccountDeps) {
  return async function handleDeleteAccount(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

    const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ error: 'UNAUTHORIZED' }, 401);

    const url = deps.env('SUPABASE_URL');
    const anonKey = deps.env('SUPABASE_ANON_KEY');
    const serviceKey = deps.env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ error: 'SERVICE_UNAVAILABLE' }, 503);

    try {
      const auth = await deps.createUserClient(url, anonKey).auth.getUser(token);
      if (auth.error || !auth.data.user) return json({ error: 'UNAUTHORIZED' }, 401);

      const user = auth.data.user;
      const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
      const appleAccessNeedsRevocation = providers.includes('apple') || user.app_metadata?.provider === 'apple';
      const admin = deps.createAdminClient(url, serviceKey);
      await removeUserAssets(admin, user.id);
      const deletion = await admin.auth.admin.deleteUser(user.id, false);
      if (deletion.error) throw new Error('Account deletion failed.');
      return json({ deleted: true, appleAccessNeedsRevocation });
    } catch {
      return json({ error: 'DELETE_FAILED' }, 500);
    }
  };
}

async function removeUserAssets(admin: DeleteAccountAdmin, userId: string): Promise<void> {
  const bucket = admin.storage.from('user-assets');
  const files = await listFiles(bucket, userId);
  for (let index = 0; index < files.length; index += 100) {
    const result = await bucket.remove(files.slice(index, index + 100));
    if (result.error) throw new Error('Asset deletion failed.');
  }
}

async function listFiles(
  bucket: ReturnType<DeleteAccountAdmin['storage']['from']>,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await bucket.list(prefix, { limit: 1000, offset });
    if (result.error) throw new Error('Asset listing failed.');
    const entries = result.data ?? [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id || entry.metadata) files.push(path);
      else files.push(...await listFiles(bucket, path));
    }
    if (entries.length < 1000) break;
  }
  return files;
}
