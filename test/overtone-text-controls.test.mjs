import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { generateRuntimeText } = await loadSource('../src/overtone/runtime-workflow.ts');

async function capture(extra = {}) {
  let submitted;
  const client = { ai: { text: { async streamTurn(input) {
    submitted = input;
    return { async *[Symbol.asyncIterator]() {
      yield { type: 'delta', text: 'Complete output' };
      yield { type: 'completed', finishReason: 'stop' };
    }, cancel: async () => {} };
  } } } };
  assert.equal(await generateRuntimeText({ client, system: 'Write from the source.', input: 'Source', ...extra }), 'Complete output');
  return submitted;
}

test('writing requests leave unset generation controls to the Runtime-owned configuration', async () => {
  assert.deepEqual(Object.keys(await capture()), ['messages']);
});
test('explicit zero temperature and token limits survive the writing adapter unchanged', async () => {
  const submitted = await capture({ temperature: 0, maxTokens: 1024 });
  assert.equal(submitted.temperature, 0);
  assert.equal(submitted.maxTokens, 1024);
});
