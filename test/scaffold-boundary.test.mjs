import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '..');
const sessionSource = readFileSync(new URL('../src/shell/mount-overtone.tsx', import.meta.url), 'utf8');
const webMainSource = readFileSync(new URL('../src/main.web.tsx', import.meta.url), 'utf8');
const productSource = readFileSync(new URL('../src/shell/routes/product-area.tsx', import.meta.url), 'utf8');
const rendererMainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const buildProfile = readFileSync(new URL('../.nimi/config/build-profile.yaml', import.meta.url), 'utf8');
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

test('desktop uses the shared managed-web carrier without an App-owned Electron host', () => {
  assert.equal(existsSync(path.join(appRoot, 'src-electron')), false);
  assert.equal(packageJson.main, undefined);
  assert.equal(packageJson.scripts.postinstall, undefined);
  assert.equal(packageJson.scripts['build:electron'], undefined);
  assert.equal(packageJson.devDependencies.electron, undefined);
  assert.match(buildProfile, /^build_profile_ref: managed-web-pnpm-vite$/m);
  assert.match(buildProfile, /^\s+desktop-universal:$/m);
  assert.match(buildProfile, /^\s+payload_path: dist\/renderer$/m);
});

test('pnpm dev is the official Electron development entrypoint', () => {
  assert.equal(packageJson.scripts.dev, 'nimi-app dev --shell electron');
  assert.equal(packageJson.scripts['dev:shell'], 'nimi-app dev');
  assert.doesNotMatch(packageJson.scripts.dev, /tauri|vite/);
});

test('generated shell rejects placeholder and private Desktop imports', () => {
  assert.doesNotMatch(appSource, /Replace this route with app product behavior/);
  assert.doesNotMatch(appSource, /Open product action/);
  assert.doesNotMatch(appSource, /Add app-owned surfaces/);
  assert.doesNotMatch(appSource, /from ['"]@renderer\//);
  assert.doesNotMatch(appSource, /from ['"]@runtime\//);
});

test('manifest declares current App Access, mediated storage, window geometry, and Electron development origin', () => {
  assert.match(manifest, /manifest_role: submitted-input/);
  assert.match(manifest, /app_access:\s*\n\s*- runtime\.consume/);
  assert.match(manifest, /electron:\s*\n\s*renderer_origin: http:\/\/127\.0\.0\.1:1507/);
  assert.match(manifest, /kind: nimi-mediated-default/);
  assert.match(manifest, /title_bar_style: native/);
  assert.doesNotMatch(manifest, /declared_nimi_api_scopes|permissions:/);
});

test('admission request remains submitted input', () => {
  assert.match(admission, /developer-submitted listing request/);
  assert.match(admission, /not an approval, release descriptor, permission grant, or install truth/);
  assert.match(admission, /Nimi Registry \/ Platform review\*\* governs catalog admission/);
});
