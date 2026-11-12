import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const platform of ['web', 'mobile']) {
  test(`${platform} build starts from its remote session entry`, async () => {
    const result = await build({
      root,
      configFile: path.join(root, `vite.${platform}.config.ts`),
      mode: platform,
      logLevel: 'silent',
      build: { write: false, minify: false },
    });
    const bundles = Array.isArray(result) ? result : [result];
    const modules = bundles.flatMap(bundle => bundle.output)
      .filter(item => item.type === 'chunk')
      .flatMap(chunk => Object.keys(chunk.modules))
      .map(id => id.replaceAll('\\', '/'));
    assert.ok(modules.some(id => id.endsWith(`/src/main.${platform}.tsx`)), `${platform} session entry was not bundled`);
    assert.ok(!modules.some(id => id.endsWith('/src/main.tsx')), 'Desktop session entry leaked into the remote bundle');
  });
}
