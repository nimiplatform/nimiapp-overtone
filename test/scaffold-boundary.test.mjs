import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sessionSource = readFileSync(new URL('../src/shell/mount-overtone.tsx', import.meta.url), 'utf8');
const webMainSource = readFileSync(new URL('../src/main.web.tsx', import.meta.url), 'utf8');
const productSource = readFileSync(new URL('../src/shell/routes/product-area.tsx', import.meta.url), 'utf8');
const rendererMainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const electronMainSource = readFileSync(new URL('../src-electron/main.ts', import.meta.url), 'utf8');
const electronPreloadSource = readFileSync(new URL('../src-electron/preload.cts', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const admission = readFileSync(new URL('../ADMISSION.md', import.meta.url), 'utf8');
const appSource = [sessionSource, webMainSource, productSource].join('\n');

test('platform entries delegate Nimi session handling to Kit', () => {
  assert.match(rendererMainSource, /createDesktopNimiAppSession/);
  assert.match(webMainSource, /createWebNimiAppSession/);
  assert.match(sessionSource, /NimiAppSessionProvider/);
  assert.doesNotMatch(appSource, /prepareRuntimeClientLogin|completeRuntimeClientLogin|createNimiRuntimeFullAppRegistration/);
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
  assert.match(admission, /Nimi Registry \/ Platform review\*\* governs catalog admission/);
});
