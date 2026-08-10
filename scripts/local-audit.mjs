import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

const manifest = parseYaml(readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8'));
if (manifest?.manifest_role !== 'submitted-input') {
  throw new Error('manifest must remain submitted input');
}
if (!Array.isArray(manifest?.app_access) || !manifest.app_access.includes('runtime.consume')) {
  throw new Error('manifest must declare runtime.consume App Access');
}
if (manifest?.permissions != null) {
  throw new Error('retired permission declarations must not be restored');
}
if (manifest?.local_development?.electron?.renderer_origin !== 'http://127.0.0.1:1507') {
  throw new Error('Electron development renderer origin mismatch');
}
process.stdout.write('[nimi-app] local-audit pre-submission self-check passed\n');
