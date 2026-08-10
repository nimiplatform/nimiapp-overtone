import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('workspace app consumes the canonical local Nimi SDK, Kit, and app-tools surfaces', () => {
  assert.equal(packageJson.dependencies['@nimiplatform/sdk'], 'link:../../nimi/sdks/typescript');
  assert.equal(packageJson.dependencies['@nimiplatform/kit'], 'link:../../nimi/kit');
  assert.equal(packageJson.devDependencies['@nimiplatform/app-tools'], 'link:../../nimi/app-tools');
  assert.equal(packageJson.devDependencies['@nimiplatform/nimi-coding'], '0.5.0');
  assert.doesNotMatch(viteConfig, /nimiRepoRoot|nimiSdkSourceRoot|nimiKitSourceRoot/);
  assert.doesNotMatch(viteConfig, /find: \/\^@nimiplatform\\\/(?:sdk|kit)/);
  assert.match(viteConfig, /dedupe:\s*\['react', 'react-dom', 'react\/jsx-runtime', 'react\/jsx-dev-runtime'\]/);
  assert.match(styles, /@source "\.\.\/node_modules\/@nimiplatform\/kit\/dist\/\*\*\/\*\.\{js,mjs\}";/);
});
