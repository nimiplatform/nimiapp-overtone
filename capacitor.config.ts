import type { CapacitorConfig } from '@capacitor/cli';
import type { NimiRemoteAppConfig } from '@nimiplatform/kit/core/app-session';

// Local Android development only; distributed App Links need separate admission.
export const mobileAccess: Omit<NimiRemoteAppConfig, 'fetch'> = {
  appId: 'nimi.overtone',
  clientId: 'nimi.overtone.android.dev',
  realmEnvironmentId: 'dev',
  realmBaseUrl: 'http://127.0.0.1:3002',
  officialWebBaseUrl: 'http://localhost:3000',
  redirectUri: 'ai.nimi.apps.overtone.dev:/oauth/callback',
};

const config: CapacitorConfig = {
  appId: 'ai.nimi.apps.overtone.dev',
  appName: 'Overtone（测试）',
  webDir: 'dist-mobile',
  loggingBehavior: 'none',
  server: { androidScheme: 'https' },
  plugins: { NimiAppAccess: {
    realmBaseUrl: mobileAccess.realmBaseUrl,
    clientId: mobileAccess.clientId,
    redirectUri: mobileAccess.redirectUri,
  } },
};
export default config;
