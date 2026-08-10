import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import './check-kit-first-style.mjs';

const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
if (!manifest.includes('manifest_role: submitted-input')) {
  throw new Error('submitted manifest role marker missing');
}
const parsedManifest = parseYaml(manifest);
if (!Array.isArray(parsedManifest?.app_access) || !parsedManifest.app_access.includes('runtime.consume')) {
  throw new Error('runtime.consume App Access declaration missing');
}
if (parsedManifest?.permissions != null) {
  throw new Error('retired permission declaration surface must be absent');
}
if (parsedManifest?.local_development?.electron?.renderer_origin !== 'http://127.0.0.1:1507') {
  throw new Error('Electron development renderer origin mismatch');
}
const submissionUrl = new URL('../.nimi/admission/submission.yaml', import.meta.url);
const buildProfileUrl = new URL('../.nimi/admission/build-profile.yaml', import.meta.url);
if (existsSync(submissionUrl) && existsSync(buildProfileUrl)) {
  const submission = readFileSync(submissionUrl, 'utf8');
  const buildProfile = readFileSync(buildProfileUrl, 'utf8');
  if (!submission.includes('submission_role: developer-submitted-input')) {
    throw new Error('developer submission role marker missing');
  }
  if (!submission.includes('dev_command: pnpm dev')) {
    throw new Error('official dev command marker missing');
  }
  if (!submission.includes('dev_electron_command: pnpm dev:electron')) {
    throw new Error('Electron dev command marker missing');
  }
  if (!submission.includes('dev_cdp_command: pnpm dev -- --cdp-port 19507')) {
    throw new Error('CDP dev command marker missing');
  }
  if (!buildProfile.includes('profile_role: developer-workflow-input')) {
    throw new Error('developer build profile marker missing');
  }
} else {
  const admission = readFileSync(new URL('../ADMISSION.md', import.meta.url), 'utf8');
  if (!admission.includes('developer-submitted listing request')) {
    throw new Error('reference admission request marker missing');
  }
}
console.log('[nimi-app] validate pre-submission self-check passed');
