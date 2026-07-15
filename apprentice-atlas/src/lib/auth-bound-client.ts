import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AuthBoundClientOptions<C extends SupabaseClient> = {
  client?: C;
  expectedUserId?: string;
  bindClient?: (accessToken: string) => C;
};

export type AuthBoundClientInput<C extends SupabaseClient> = C | AuthBoundClientOptions<C>;

type TestBindableClient<C> = C & {
  createAuthBoundClient?: (accessToken: string) => C;
};

type SupabaseClientInternals = {
  supabaseUrl?: string;
  supabaseKey?: string;
  headers?: Record<string, string>;
};

export type BoundClientResult<C extends SupabaseClient> = {
  client: C | null;
  userId: string | null;
  error: { code: 'configuration' | 'auth-required' | 'query'; message: string } | null;
};

function isClient<C extends SupabaseClient>(input: AuthBoundClientInput<C>): input is C {
  return typeof input === 'object' && input !== null && 'auth' in input;
}

function bindCapturedToken<C extends SupabaseClient>(
  client: C,
  accessToken: string,
  suppliedBinder?: (accessToken: string) => C,
): C {
  if (suppliedBinder) return suppliedBinder(accessToken);
  const testBinder = (client as TestBindableClient<C>).createAuthBoundClient;
  if (testBinder) return testBinder.call(client, accessToken);

  const internals = client as unknown as SupabaseClientInternals;
  if (!internals.supabaseUrl || !internals.supabaseKey) {
    throw new Error('The authenticated database client could not be bound to the current session.');
  }
  return createClient(internals.supabaseUrl, internals.supabaseKey, {
    accessToken: async () => accessToken,
    global: {
      headers: {
        ...internals.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  }) as C;
}

export async function resolveAuthBoundClient<C extends SupabaseClient>(
  input: AuthBoundClientInput<C> | undefined,
  loadDefault: () => Promise<C>,
): Promise<BoundClientResult<C>> {
  let client: C;
  let expectedUserId: string | undefined;
  let suppliedBinder: ((accessToken: string) => C) | undefined;
  try {
    if (input && isClient(input)) {
      client = input;
    } else {
      client = input?.client ?? await loadDefault();
      expectedUserId = input?.expectedUserId;
      suppliedBinder = input?.bindClient;
    }
  } catch (error) {
    return { client: null, userId: null, error: { code: 'configuration', message: error instanceof Error ? error.message : 'Supabase is not configured.' } };
  }

  try {
    const result = await client.auth.getSession();
    if (result.error) {
      return { client: null, userId: null, error: { code: 'query', message: result.error.message || 'Could not read the session.' } };
    }
    const session = result.data.session;
    if (!session?.user.id || !session.access_token) {
      return { client: null, userId: null, error: { code: 'auth-required', message: 'Sign in to continue.' } };
    }
    if (expectedUserId && session.user.id !== expectedUserId) {
      return { client: null, userId: null, error: { code: 'auth-required', message: 'The authenticated account changed during the operation.' } };
    }
    return {
      client: bindCapturedToken(client, session.access_token, suppliedBinder),
      userId: session.user.id,
      error: null,
    };
  } catch (error) {
    return { client: null, userId: null, error: { code: 'query', message: error instanceof Error ? error.message : 'Could not bind the authenticated session.' } };
  }
}
