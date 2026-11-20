import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

async function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('web local-dev build starts from its remote session entry', async () => {
  const result = await withEnv({ NIMI_DEV_REALM: 'local' }, () =>
    build({
      root,
      configFile: path.join(root, 'vite.web.config.ts'),
      mode: 'web',
      logLevel: 'silent',
      build: { write: false, minify: false },
    }),
  );
  const bundles = Array.isArray(result) ? result : [result];
  const modules = bundles.flatMap(bundle => bundle.output)
    .filter(item => item.type === 'chunk')
    .flatMap(chunk => Object.keys(chunk.modules))
    .map(id => id.replaceAll('\\', '/'));
  assert.ok(modules.some(id => id.endsWith('/src/main.web.tsx')), 'web session entry was not bundled');
  assert.ok(!modules.some(id => id.endsWith('/src/main.tsx')), 'Desktop session entry leaked into the remote bundle');
});

test('web hosted release build emits overtone bundle identity and versioned assets', async () => {
  const result = await withEnv(
    { NIMI_DEV_REALM: undefined, NIMI_WEB_VERSION: '0.1.9', NIMI_WEB_ARCHIVE: undefined },
    () =>
      build({
        root,
        configFile: path.join(root, 'vite.web.config.ts'),
        mode: 'web-release',
        logLevel: 'silent',
        build: { write: false, minify: false },
      }),
  );
  const bundles = Array.isArray(result) ? result : [result];
  const output = bundles.flatMap(bundle => bundle.output);
  const modules = output
    .filter(item => item.type === 'chunk')
    .flatMap(chunk => Object.keys(chunk.modules))
    .map(id => id.replaceAll('\\', '/'));
  assert.ok(modules.some(id => id.endsWith('/src/main.web.tsx')), 'web-release session entry was not bundled');
  assert.ok(!modules.some(id => id.endsWith('/src/main.tsx')), 'Desktop session entry leaked into the hosted Web bundle');

  const manifestAsset = output.find(item => item.type === 'asset' && item.fileName === 'nimi-web-bundle.json');
  assert.ok(manifestAsset && typeof manifestAsset.source === 'string', 'nimi-web-bundle.json missing');
  const manifest = JSON.parse(manifestAsset.source);
  assert.deepEqual(manifest, {
    format: 'nimi.web-bundle/v1',
    app_id: 'nimi.overtone',
    slug: 'overtone',
    version: '0.1.9',
    client_id: 'nimi.overtone.web',
    origin: 'https://overtone.nimi.xyz',
    redirect_uri: 'https://overtone.nimi.xyz/',
    official_web_url: 'https://nimi.ai',
    realm_environment_id: 'production',
    entry: 'index.html',
    app_access: ['runtime.consume'],
    capability_contract_refs: [
      'text.generate',
      'music.generate',
      'music.transcribe',
      'audio.voice.convert',
      'audio.separate',
    ],
  });
  assert.ok(
    output.some(item => item.fileName.startsWith('_releases/0.1.9/assets/') && item.fileName.endsWith('.js')),
    'versioned JS asset missing under _releases/0.1.9/assets/',
  );
});

test('mobile build starts from its remote session entry', async () => {
  const result = await build({
    root,
    configFile: path.join(root, 'vite.mobile.config.ts'),
    mode: 'mobile',
    logLevel: 'silent',
    build: { write: false, minify: false },
  });
  const bundles = Array.isArray(result) ? result : [result];
  const modules = bundles.flatMap(bundle => bundle.output)
    .filter(item => item.type === 'chunk')
    .flatMap(chunk => Object.keys(chunk.modules))
    .map(id => id.replaceAll('\\', '/'));
  assert.ok(modules.some(id => id.endsWith('/src/main.mobile.tsx')), 'mobile session entry was not bundled');
  assert.ok(!modules.some(id => id.endsWith('/src/main.tsx')), 'Desktop session entry leaked into the remote bundle');
});
