import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { bindProjectStorage } = await loadSource('../src/overtone/session-storage.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('a closed connection never dispatches a queued storage write through its old port', async () => {
  const controller = new AbortController(); let calls = 0;
  const port = bindProjectStorage({ client: { storage: { assets: {}, async writeJson() { calls++; } } }, signal: controller.signal, viewKey: 'old' });
  controller.abort();
  await assert.rejects(port.writeJson('workspace/current.json', {}), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('a late storage response is discarded and does not borrow the new connection', async () => {
  const controller = new AbortController(); const pending = deferred(); let newCalls = 0;
  const old = bindProjectStorage({ client: { storage: { assets: {}, readJson: () => pending.promise } }, signal: controller.signal, viewKey: 'old' });
  const reading = old.readJson('workspace/current.json'); const rejected = assert.rejects(reading, { name: 'AbortError' });
  controller.abort();
  const current = bindProjectStorage({ client: { storage: { assets: {}, async readJson() { newCalls++; return { value: { project: 'new' } }; } } }, signal: new AbortController().signal, viewKey: 'new' });
  pending.resolve({ value: { project: 'old' } }); await rejected;
  assert.equal(newCalls, 0);
  assert.equal((await current.readJson('workspace/current.json')).value.project, 'new');
});
