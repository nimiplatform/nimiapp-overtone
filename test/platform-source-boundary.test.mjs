import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('standalone app consumes Nimi package exports without source aliases', () => {
  assert.doesNotMatch(viteConfig, /nimiRepoRoot|nimiSdkSourceRoot|nimiKitSourceRoot/);
  assert.doesNotMatch(viteConfig, /find: \/\^@nimiplatform\\\/(?:sdk|kit)/);
  assert.match(viteConfig, /dedupe:\s*\['react', 'react-dom', 'react\/jsx-runtime', 'react\/jsx-dev-runtime'\]/);
  assert.match(styles, /@source "\.\.\/node_modules\/@nimiplatform\/kit\/dist\/\*\*\/\*\.\{js,mjs\}";/);
});
