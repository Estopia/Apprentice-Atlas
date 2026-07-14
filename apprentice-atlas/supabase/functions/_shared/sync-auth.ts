export interface SyncAuthConfig {
  internalSecret?: string;
  serviceRoleKey?: string;
  secretKeys?: string[];
}

export function isSyncRequestAuthorized(request: Request, config: SyncAuthConfig): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = request.headers.get('x-sync-internal-secret') ?? '';
  const suppliedApiKey = request.headers.get('apikey') ?? '';
  const secretKeys = (config.secretKeys ?? []).filter(Boolean);
  return Boolean(
    (config.internalSecret && suppliedSecret === config.internalSecret)
      || (config.internalSecret && authorization === `Bearer ${config.internalSecret}`)
      || (config.serviceRoleKey && authorization === `Bearer ${config.serviceRoleKey}`)
      || (config.serviceRoleKey && suppliedApiKey === config.serviceRoleKey)
      || (suppliedApiKey && secretKeys.includes(suppliedApiKey)),
  );
}
