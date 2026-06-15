import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

function blockAfter(label) {
  return viteConfig.match(new RegExp(`${label}:\\s*\\[([\\s\\S]*?)\\]`))?.[1] ?? '';
}

test('standalone app consumes Nimi SDK and Kit through package exports', () => {
  assert.match(packageJson, /"@nimiplatform\/sdk": "\^0\.6\.0"/);
  assert.match(packageJson, /"@nimiplatform\/kit": "\^0\.2\.0"/);
  assert.doesNotMatch(packageJson, /"@nimiplatform\/(?:sdk|kit)": "(?:link|file):/);
  assert.doesNotMatch(viteConfig, /nimiRepoRoot|nimiSdkSourceRoot|nimiKitSourceRoot/);
  assert.doesNotMatch(viteConfig, /find: \/\^@nimiplatform\\\/(?:sdk|kit)/);
  assert.doesNotMatch(blockAfter('include'), /@nimiplatform\/(?:sdk|kit)/);
  assert.match(styles, /@source "\.\.\/node_modules\/@nimiplatform\/kit\/dist\/\*\*\/\*\.\{js,mjs\}";/);
  assert.doesNotMatch(styles, /\.\.\/\.\.\/nimi-realm\/nimi\/kit/);
});
