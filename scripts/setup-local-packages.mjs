import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Prepare the complete public npm archives supplied by the platform owner.
// This does not build packages from source or claim public-release readiness.
const source = process.argv.slice(2).filter(value => value !== '--')[0];
if (!source) throw new Error('Usage: pnpm setup:packages -- <directory containing the matching SDK, Kit, App Tools and host-native .tgz files>');
const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const workspacePath = path.join(root, 'pnpm-workspace.yaml');
const workspaceText = readFileSync(workspacePath, 'utf8');
const lockPath = path.join(root, 'pnpm-lock.yaml');
const lockText = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : '';
const selected = [
  ['@nimiplatform/sdk', manifest.dependencies['@nimiplatform/sdk'].replace(/^\^/, '')],
  ['@nimiplatform/kit', manifest.dependencies['@nimiplatform/kit'].replace(/^\^/, '')],
  ['@nimiplatform/app-tools', manifest.devDependencies['@nimiplatform/app-tools'].replace(/^\^/, '')],
];
const nativeVersion = selected[1][1];
const hostNative = `@nimiplatform/kit-protected-local-${process.platform}-${process.arch}`;
const nativeNames = ['@nimiplatform/kit-protected-local-darwin-arm64', '@nimiplatform/kit-protected-local-win32-x64'];
if (!nativeNames.includes(hostNative)) throw new Error(`No declared native carrier for ${process.platform}-${process.arch}`);
for (const name of nativeNames) {
  if (name === hostNative || existsSync(path.join(source, `${name.slice(1).replace('/', '-')}-${nativeVersion}.tgz`))) selected.push([name, nativeVersion]);
}
const archives = selected.map(([name, version]) => {
  const fileName = `${name.slice(1).replace('/', '-')}-${version}.tgz`;
  const archive = path.resolve(source, fileName);
  if (!existsSync(archive)) throw new Error(`Missing complete candidate archive: ${archive}`);
  const metadata = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
  if (metadata.name !== name || metadata.version !== version) throw new Error(`Archive identity mismatch: ${fileName}`);
  // Read pnpm 10's archive resolution line without requiring dependencies to
  // already be installed: this preparation command must work in a fresh clone.
  const override = workspaceText.split('\n').find(line => line.trim().split(':')[0].replaceAll("'", '').replaceAll('"', '') === name);
  const specifier = override?.slice(override.indexOf(':') + 1).trim().replaceAll("'", '').replaceAll('"', '');
  if (!specifier?.startsWith('file:.nimi/local/packages/') || specifier.includes('..') || path.basename(specifier) !== fileName) throw new Error(`Expected a reviewed local archive override for ${name}`);
  const relativeTarget = specifier.slice('file:'.length);
  const lockedLine = lockText.split('\n').find(line => line.match(/\btarball:\s*['"]?([^,'"}\s]+)/)?.[1] === specifier);
  const lockedIntegrity = lockedLine?.match(/\bintegrity:\s*['"]?(sha512-[A-Za-z0-9+/=]+)/)?.[1];
  if (!lockedIntegrity) throw new Error(`No pinned candidate integrity for ${fileName}. Select and lock the complete supported host combination before preparing it.`);
  const integrity = `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`;
  if (lockedIntegrity && lockedIntegrity !== integrity) throw new Error(`Archive does not match the pinned lockfile: ${fileName}. Obtain the exact reviewed candidate bytes.`);
  return { name, version, fileName, archive, metadata, relativeTarget, specifier };
});
const tools = archives.find(item => item.name === '@nimiplatform/app-tools').metadata;
if (tools.nimiScaffoldVersions?.nimicodingVersion !== manifest.devDependencies['@nimiplatform/nimi-coding']) throw new Error('App Tools and pinned nimi-coding do not match');
const directory = path.join(root, '.nimi/local/packages');
mkdirSync(directory, { recursive: true });
const lines = workspaceText.split('\n');
const start = lines.findIndex(line => /^overrides:\s*$/.test(line));
if (start < 0) throw new Error('Expected the project pnpm-workspace.yaml overrides mapping');
let end = start + 1;
while (end < lines.length && (!lines[end].trim() || /^\s|^#/.test(lines[end]))) end++;
const replaced = new Set([...selected.map(([name]) => name), ...nativeNames]);
const retained = lines.slice(start + 1, end).filter(line => !replaced.has(line.trim().split(':')[0].replaceAll("'", '').replaceAll('"', '')));
const overrides = [];
for (const item of archives) {
  const target = path.join(root, item.relativeTarget);
  mkdirSync(path.dirname(target), { recursive: true });
  if (item.archive !== target) copyFileSync(item.archive, target);
  overrides.push(`  '${item.name}': '${item.specifier}'`);
}
lines.splice(start + 1, end - start - 1, ...retained.filter(line => line.trim()), ...overrides, '');
writeFileSync(workspacePath, lines.join('\n'));
console.log(`Prepared ${archives.map(item => `${item.name}@${item.version}`).join(', ')}. Run pnpm install, then pnpm exec nimi-app check.`);
