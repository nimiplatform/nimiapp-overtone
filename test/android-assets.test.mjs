import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const staged = new Map();
const appends = [];
let deletes = 0;
let onAppend = () => {};
let shareFailure;
globalThis.__overtoneAndroidShareTest = { async share() { if (shareFailure) throw shareFailure; } };
globalThis.__overtoneAndroidFilesTest = {
  async writeFile({ path, data }) { assert.equal(data, ''); staged.set(path, []); return { uri: `file:///cache/${path}` }; },
  async appendFile({ path, data }) { const bytes = Buffer.from(data, 'base64'); appends.push(bytes.length); staged.get(path).push(bytes); onAppend(); },
  async deleteFile({ path }) { deletes += 1; staged.delete(path); },
  async rmdir() {},
};
const built = await build({
  entryPoints: ['src/shell/android-assets.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'native-files-unit-boundary', setup(builder) {
    builder.onResolve({ filter: /^@capacitor\/filesystem$/ }, () => ({ path: 'filesystem', namespace: 'unit' }));
    builder.onLoad({ filter: /.*/, namespace: 'unit' }, () => ({ loader: 'js', contents: 'export const Directory = { Cache: "CACHE" }; export const Filesystem = globalThis.__overtoneAndroidFilesTest;' }));
    builder.onResolve({ filter: /^@capacitor\/share$/ }, () => ({ path: 'share', namespace: 'share-unit' }));
    builder.onLoad({ filter: /.*/, namespace: 'share-unit' }, () => ({ loader: 'js', contents: 'export const Share = globalThis.__overtoneAndroidShareTest;' }));
  } }],
});
const { cacheAndroidAsset, shareAndroidAsset } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const scopeFor = (signal, body) => ({ signal, client: { storage: { assets: { read: async () => ({ body }) } } } });
test.beforeEach(() => { staged.clear(); appends.length = 0; deletes = 0; onAppend = () => {}; shareFailure = undefined; });
test.after(() => { delete globalThis.__overtoneAndroidFilesTest; delete globalThis.__overtoneAndroidShareTest; });

test('dismissing Android sharing is cancellation, while a real delivery failure still rejects', async () => {
  const scope = () => scopeFor(new AbortController().signal, (async function* () { yield new Uint8Array([1, 2, 3]); })());
  shareFailure = new Error('Share canceled');
  assert.equal(await shareAndroidAsset(scope(), 'music/test.wav', 'test.wav'), 'cancelled');
  assert.equal(staged.size, 0);
  shareFailure = new Error('No Activity found to handle Intent');
  await assert.rejects(shareAndroidAsset(scope(), 'music/test.wav', 'test.wav'), /No Activity found/);
  assert.equal(staged.size, 0);
  shareFailure = undefined;
  assert.equal(await shareAndroidAsset(scope(), 'music/test.wav', 'test.wav'), 'handed-off');
  assert.equal(staged.size, 1);
});

test('Android staging preserves uneven binary chunks while bounding each native write', async () => {
  const original = Uint8Array.from({ length: 3 * 1024 * 1024 + 7 }, (_, index) => index % 251);
  const body = (async function* () { yield original.subarray(0, 200003); yield original.subarray(200003); })();
  const file = await cacheAndroidAsset(scopeFor(new AbortController().signal, body), 'music/original.wav', 'original.wav', 'media');
  assert.ok(file.uri.endsWith('/original.wav'));
  assert.ok(appends.length > 2);
  assert.ok(Math.max(...appends) <= 64 * 1024);
  assert.deepEqual(Buffer.concat([...staged.values()][0]), Buffer.from(original));
  await file.remove(); await file.remove();
  assert.equal(deletes, 1);
  assert.equal(staged.size, 0);
});

test('a disconnected read cleans the partial cache instead of returning a playable file', async () => {
  const controller = new AbortController();
  let closed = false;
  const body = (async function* () { try { yield new Uint8Array(200000); } finally { closed = true; } })();
  onAppend = () => controller.abort(new Error('connection closed'));
  await assert.rejects(cacheAndroidAsset(scopeFor(controller.signal, body), 'music/original.wav', 'original.wav', 'exports'), /connection closed/);
  assert.equal(closed, true);
  assert.equal(appends.length, 1);
  assert.equal(staged.size, 0);
});
