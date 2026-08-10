import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtimePlatformSource = readFileSync(new URL('../src/shell/auth/runtime-platform.ts', import.meta.url), 'utf8');
const localAppClientSource = readFileSync(new URL('../src/shell/auth/local-app-client.ts', import.meta.url), 'utf8');
const authGateSource = readFileSync(new URL('../src/shell/auth/auth-gate.tsx', import.meta.url), 'utf8');
const productSource = readFileSync(new URL('../src/shell/routes/product-area.tsx', import.meta.url), 'utf8');
const demoSource = readFileSync(new URL('../src/shell/routes/demo-surfaces.tsx', import.meta.url), 'utf8');
const rendererMainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const electronMainSource = readFileSync(new URL('../src-electron/main.ts', import.meta.url), 'utf8');
const electronPreloadSource = readFileSync(new URL('../src-electron/preload.cts', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const admission = readFileSync(new URL('../ADMISSION.md', import.meta.url), 'utf8');
const appSource = [runtimePlatformSource, localAppClientSource, authGateSource, productSource, demoSource].join('\n');

test('renderer consumes only the host-protected Local App client', () => {
  assert.match(localAppClientSource, /createNimiClient/);
  assert.match(localAppClientSource, /createNimiLocalAppStandardShellSurface/);
  assert.match(runtimePlatformSource, /getNimiLocalAppClient\(\)\.auth\.status\(\)/);
  assert.match(runtimePlatformSource, /sessionBound/);
  assert.doesNotMatch(appSource, /createNimiRuntimeFullAppRegistration|createNimiLocalFirstPartyRuntimeAccountCaller/);
  assert.doesNotMatch(appSource, /runtime\.account\.|beginLogin|completeLogin|accessToken|refreshToken/);
  assert.doesNotMatch(appSource, /createNimiAppRuntimePlatformClient|createPlatformClient\s*\(/);
});

test('auth gate fails closed and retries the protected session projection', () => {
  assert.match(authGateSource, /projection\.status !== 'ready'/);
  assert.match(authGateSource, /clearRuntimePlatformProjection\(\)/);
  assert.match(authGateSource, /<RuntimeUnavailablePage/);
  assert.doesNotMatch(authGateSource, /RuntimeLoginPage|developer-session|dev-standalone/);
});

test('renderer bootstrap installs Kit runtime bridge before render', () => {
  assert.match(
    rendererMainSource,
    /import \{[^}]*installNimiShellRuntimeBridge[^}]*\} from '@nimiplatform\/kit\/shell\/renderer\/bridge'/,
  );
  const bootstrapAt = rendererMainSource.indexOf('installNimiShellRuntimeBridge()');
  const renderAt = rendererMainSource.indexOf('.render(');
  assert.ok(bootstrapAt > -1, 'main.tsx must call installNimiShellRuntimeBridge()');
  assert.match(rendererMainSource, /createRendererEntryModuleLoader/);
  assert.ok(renderAt > -1, 'main.tsx must render the app');
  assert.ok(bootstrapAt < renderAt, 'bootstrap must run before render');
  assert.doesNotMatch(rendererMainSource, /__NIMI_TAURI_RUNTIME__/);
});

test('Electron shell uses the protected Kit bridge and asset protocol', () => {
  assert.match(electronMainSource, /registerNimiElectronAppAssetProtocolScheme\(protocol\)/);
  assert.match(electronMainSource, /registerNimiElectronAppBridge\(/);
  assert.match(electronMainSource, /assetMediaPlatform:\s*\{ protocol, webRequest: session\.defaultSession\.webRequest, webContents \}/);
  assert.match(electronMainSource, /contextIsolation:\s*true/);
  assert.match(electronMainSource, /nodeIntegration:\s*false/);
  assert.match(electronMainSource, /sandbox:\s*true/);
  assert.match(electronMainSource, /--nimi-dev-renderer-url=/);
  assert.doesNotMatch(electronMainSource, /remote-debugging-port|cdp-port/);
  assert.match(electronPreloadSource, /installNimiElectronRuntimeBridge/);
});

test('pnpm dev is the official Electron development entrypoint', () => {
  assert.equal(packageJson.scripts.dev, 'nimi-app dev --shell electron');
  assert.equal(packageJson.scripts['dev:electron'], 'nimi-app dev --shell electron');
  assert.equal(packageJson.scripts['build:electron'], 'tsc -p tsconfig.electron.json && node scripts/bundle-electron-preload.mjs');
  assert.doesNotMatch(packageJson.scripts.dev, /tauri|vite/);
});

test('generated shell rejects placeholder and private Desktop imports', () => {
  assert.doesNotMatch(appSource, /Replace this route with app product behavior/);
  assert.doesNotMatch(appSource, /Open product action/);
  assert.doesNotMatch(appSource, /Add app-owned surfaces/);
  assert.doesNotMatch(appSource, /from ['"]@renderer\//);
  assert.doesNotMatch(appSource, /from ['"]@runtime\//);
});

test('manifest declares current App Access and Electron development origin', () => {
  assert.match(manifest, /manifest_role: submitted-input/);
  assert.match(manifest, /app_access:\s*\n\s*- runtime\.consume/);
  assert.match(manifest, /electron:\s*\n\s*renderer_origin: http:\/\/127\.0\.0\.1:1507/);
  assert.doesNotMatch(manifest, /declared_nimi_api_scopes|permissions:/);
});

test('admission request remains submitted input', () => {
  assert.match(admission, /developer-submitted listing request/);
  assert.match(admission, /not an approval, release descriptor, permission grant, or install truth/);
  assert.match(admission, /Nimi Platform review owns final admission/);
});
