import { createNimiClient, createRealmFetchTransport, type NimiClient, type NimiClientConfig } from '@nimiplatform/sdk';

export const appId = 'nimi.overtone';
export const appTitle = 'Nimi Overtone';
export const scaffoldProfile = 'standalone' as const;
export const runtimeAccountLoginEnabled = true;

type RuntimeEnv = Record<string, string | boolean | undefined>;
export type RuntimeAuthMode = 'dev-standalone' | 'local-first-party' | 'third-party-nimi-app';

export type RuntimePlatformReadyProjection = {
  readonly status: 'ready';
  readonly mode: RuntimeAuthMode;
  readonly client: NimiClient;
  readonly auth: {
    readonly source: 'runtime-developer-session' | 'runtime-account' | 'third-party-nimi-app';
  };
};

export type RuntimePlatformUnavailableProjection = {
  readonly status: 'unavailable';
  readonly mode: RuntimeAuthMode;
  readonly message: string;
  readonly actionHint?: string;
};

export type RuntimePlatformProjection =
  | RuntimePlatformReadyProjection
  | RuntimePlatformUnavailableProjection;

let runtimeProjection: Promise<RuntimePlatformProjection> | null = null;
let runtimeClient: NimiClient | null = null;

function runtimeEnv(): RuntimeEnv {
  return ((import.meta as ImportMeta & { env?: RuntimeEnv }).env || {});
}

function resolveRuntimeAuthMode(env: RuntimeEnv): RuntimeAuthMode {
  if (env.VITE_NIMI_APP_AUTH_MODE === 'dev-standalone') {
    return 'dev-standalone';
  }
  return runtimeAccountLoginEnabled ? 'local-first-party' : 'third-party-nimi-app';
}

export function clearRuntimePlatformProjection() {
  runtimeProjection = null;
  runtimeClient = null;
}

export function getRuntimePlatformProjection() {
  const env = runtimeEnv();
  const mode = resolveRuntimeAuthMode(env);
  runtimeProjection ??= createRuntimePlatformProjection(mode, env);
  return runtimeProjection;
}

export function getOvertoneNimiClient(): NimiClient {
  if (!runtimeClient) {
    throw new Error('Nimi Runtime client is not initialized. Wait for Runtime platform projection to become ready.');
  }
  return runtimeClient;
}

async function createRuntimePlatformProjection(
  mode: RuntimeAuthMode,
  env: RuntimeEnv,
): Promise<RuntimePlatformProjection> {
  const developerSession = readDeveloperSession(env);
  const client = createNimiClient({
    appId,
    runtime: {
      appId,
      transport: {
        type: 'tauri-ipc',
        commandNamespace: 'runtime_bridge',
        eventNamespace: 'runtime_bridge',
      },
      authMetadata: async (): Promise<Readonly<Record<string, string>>> => {
        if (!developerSession) return {};
        return {
          'x-nimi-session-id': developerSession.sessionId,
          'x-nimi-session-token': developerSession.sessionToken,
        };
      },
    },
    realm: createRealmConfig(env),
    app: false,
    permissions: false,
  });

  try {
    await client.runtime.ready({ timeoutMs: 5_000 });
  } catch (error) {
    return {
      status: 'unavailable',
      mode,
      message: error instanceof Error ? error.message : String(error || 'Runtime readiness failed'),
      actionHint: 'check_runtime_bridge_and_daemon',
    };
  }

  runtimeClient = client;
  return {
    status: 'ready',
    mode,
    client,
    auth: {
      source: developerSession
        ? 'runtime-developer-session'
        : mode === 'local-first-party'
          ? 'runtime-account'
          : 'third-party-nimi-app',
    },
  };
}

function readDeveloperSession(env: RuntimeEnv): { readonly sessionId: string; readonly sessionToken: string } | null {
  const sessionId = String(env.VITE_NIMI_RUNTIME_DEVELOPER_SESSION_ID || '').trim();
  const sessionToken = String(env.VITE_NIMI_RUNTIME_DEVELOPER_SESSION_TOKEN || '').trim();
  return sessionId && sessionToken ? { sessionId, sessionToken } : null;
}

function createRealmConfig(env: RuntimeEnv): NimiClientConfig['realm'] {
  const realmBaseUrl = String(env.VITE_NIMI_REALM_BASE_URL || '').trim();
  if (!realmBaseUrl) return false;
  return {
    transport: createRealmFetchTransport({
      baseUrl: realmBaseUrl,
      credentials: 'include',
    }),
  };
}
