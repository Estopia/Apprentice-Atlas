export interface SyncAuthConfig {
  internalSecret?: string;
  serviceRoleKey?: string;
}

export function isSyncRequestAuthorized(request: Request, config: SyncAuthConfig): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const suppliedSecret = request.headers.get('x-sync-internal-secret') ?? '';
  return Boolean(
    (config.internalSecret && suppliedSecret === config.internalSecret)
      || (config.internalSecret && authorization === `Bearer ${config.internalSecret}`)
      || (config.serviceRoleKey && authorization === `Bearer ${config.serviceRoleKey}`),
  );
}
