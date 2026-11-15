import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('package preparation uses locked Kit rc4 and native rc1, preserving existing archive bytes', async () => {
  const testParent = path.resolve('.nimi/local');
  await mkdir(testParent, { recursive: true });
  const directory = await mkdtemp(path.join(testParent, 'package-setup-'));
  assert.equal(path.dirname(directory), testParent);
  const source = path.join(directory, 'supplied');
  const project = path.join(directory, 'app');
  await mkdir(source); await mkdir(project);
  try {
    const native = `@nimiplatform/kit-protected-local-${process.platform}-${process.arch}`;
    const packages = [
      ['@nimiplatform/sdk', '0.24.0-rc.2'], ['@nimiplatform/kit', '0.24.0-rc.4'],
      ['@nimiplatform/app-tools', '0.16.0-rc.2'], [native, '0.24.0-rc.1'],
    ];
    const overrides = [], resolutions = [];
    // Metadata archives are isolated copy/identity fixtures, not platform
    // package builds or evidence of a running App.
    for (const [name, version] of packages) {
      const staging = path.join(directory, name.slice(1).replace('/', '-'));
      await mkdir(path.join(staging, 'package'), { recursive: true });
      await writeFile(path.join(staging, 'package/package.json'), JSON.stringify({ name, version, nimiScaffoldVersions: { nimicodingVersion: '0.7.0' } }));
      const file = `${name.slice(1).replace('/', '-')}-${version}.tgz`;
      execFileSync('tar', ['-czf', path.join(source, file), '-C', staging, 'package']);
      const integrity = 'sha512-' + createHash('sha512').update(await readFile(path.join(source, file))).digest('base64');
      const specifier = `file:.nimi/local/packages/rc4/${file}`;
      overrides.push(`  '${name}': '${specifier}'`);
      resolutions.push(`  ${file}:\n    resolution: {integrity: ${integrity}, tarball: ${specifier}}`);
    }
    await writeFile(path.join(project, 'package.json'), JSON.stringify({ dependencies: { '@nimiplatform/sdk': '^0.24.0-rc.2', '@nimiplatform/kit': '^0.24.0-rc.1' }, devDependencies: { '@nimiplatform/app-tools': '^0.16.0-rc.2', '@nimiplatform/nimi-coding': '0.7.0' } }));
    await writeFile(path.join(project, 'pnpm-workspace.yaml'), `packages:\n  - .\noverrides:\n${overrides.join('\n')}\n`);
    await writeFile(path.join(project, 'pnpm-lock.yaml'), `packages:\n${resolutions.join('\n')}\n`);
    const script = path.resolve('scripts/setup-local-packages.mjs');
    const first = spawnSync(process.execPath, [script, source], { cwd: project, encoding: 'utf8', windowsHide: true });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /@nimiplatform\/kit@0\.24\.0-rc\.4/);
    assert.match(first.stdout, /protected-local-.*@0\.24\.0-rc\.1/);
    const copiedKit = path.join(project, '.nimi/local/packages/rc4/nimiplatform-kit-0.24.0-rc.4.tgz');
    assert.deepEqual(await readFile(copiedKit), await readFile(path.join(source, path.basename(copiedKit))));
    await writeFile(copiedKit, 'keep-existing-candidate');
    const second = spawnSync(process.execPath, [script, source], { cwd: project, encoding: 'utf8', windowsHide: true });
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /Existing archive differs/);
    assert.equal(await readFile(copiedKit, 'utf8'), 'keep-existing-candidate');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
