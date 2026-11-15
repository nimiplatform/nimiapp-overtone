import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { loadSource } from './load-source.mjs';

const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { useReadiness } = await loadSource('../src/overtone/use-readiness.ts');
function Readiness({ client, signal, publish, reloadKey = 0 }) {
  useReadiness(client, signal, publish, reloadKey);
  return null;
}
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const ready = { effectiveSelections: [{ capabilityContract: 'text.generate', state: 'ready' }] };
let root;
test.beforeEach(() => { root = createRoot(document.getElementById('root')); });
test.afterEach(async () => { await act(async () => root.unmount()); });
test.after(() => dom.window.close());
const render = props => act(async () => root.render(React.createElement(Readiness, props)));

test('disconnect drops pending readiness without publishing an abort error or refreshing a closed scope', async () => {
  const controller = new AbortController();
  const pending = deferred();
  const snapshots = [];
  let calls = 0;
  const props = { client: { aiConfig: { get() { calls++; return pending.promise; } } }, signal: controller.signal, publish: value => snapshots.push(value) };
  await render(props);
  assert.equal(calls, 1);
  await act(async () => { controller.abort(); pending.resolve(ready); });
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  await render({ ...props, reloadKey: 1 });
  assert.equal(calls, 1);
  assert.deepEqual(snapshots, []);
});

test('replacement scope keeps its own readiness and discards a late old failure', async () => {
  const pending = deferred();
  const snapshots = [];
  const publish = value => snapshots.push(value);
  await render({ client: { aiConfig: { get: () => pending.promise } }, signal: new AbortController().signal, publish });
  await render({ client: { aiConfig: { get: async () => ready } }, signal: new AbortController().signal, publish });
  await act(async () => pending.reject(new Error('old connection failed')));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].runtimeStatus, 'ready');
  assert.equal(snapshots[0].textCapabilityAvailable, true);
});

test('active-scope failures remain visible and explicit retry can refresh them', async () => {
  let fail = true;
  let calls = 0;
  const snapshots = [];
  const props = { client: { aiConfig: { async get() { calls++; if (fail) throw new Error('current connection failed'); return ready; } } }, signal: new AbortController().signal, publish: value => snapshots.push(value) };
  await render(props);
  assert.equal(snapshots[0].runtimeStatus, 'unavailable');
  assert.equal(snapshots[0].runtimeErrorMessage, 'current connection failed');
  fail = false;
  await render({ ...props, reloadKey: 1 });
  assert.equal(calls, 2);
  assert.equal(snapshots[1].runtimeStatus, 'ready');
});
