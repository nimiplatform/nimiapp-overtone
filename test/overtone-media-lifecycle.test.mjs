import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './load-source.mjs';
const { MusicAudioCache } = await loadSource('../src/overtone/media-cache.ts');
const { overtoneReducer } = await loadSource('../src/overtone/store.tsx');
const { generateRuntimeText, recoverRuntimeMusic, createMusicVersion } = await loadSource('../src/overtone/runtime-workflow.ts');
const audio = () => ({duration:1,length:4,numberOfChannels:1,getChannelData:()=>Float32Array.of(0,.2,-.8,.1)});
const signal = () => new AbortController().signal;
const flush = () => new Promise(resolve => setImmediate(resolve));

test('abandoned reads release the queue and canceled queued selections never read or decode', async () => {
  const calls = []; let finishA;
  const cache = new MusicAudioCache(48, async bytes => { calls.push(`decode:${new Uint8Array(bytes)[0]}`); return audio(); });
  const a = new AbortController(), b = new AbortController();
  const first = cache.load('a', () => { calls.push('read:a'); return new Promise(resolve => { finishA = resolve; }); }, a.signal);
  const firstRejected = assert.rejects(first, { name: 'AbortError' });
  await flush();
  const second = cache.load('b', async () => { calls.push('read:b'); return Uint8Array.of(2).buffer; }, b.signal);
  const secondRejected = assert.rejects(second, { name: 'AbortError' });
  a.abort(); b.abort();
  await cache.load('c', async () => { calls.push('read:c'); return Uint8Array.of(3).buffer; }, signal());
  await Promise.all([firstRejected, secondRejected]);
  assert.deepEqual(calls, ['read:a', 'read:c', 'decode:3']);
  finishA(Uint8Array.of(1).buffer); await flush();
  assert.equal(cache.getSnapshot('a'), undefined);
  assert.deepEqual(calls, ['read:a', 'read:c', 'decode:3']);
  cache.clear();
});

test('canceling one coalesced consumer preserves the shared read for another', async () => {
  let finish, workSignal, reads = 0, decodes = 0;
  const cache = new MusicAudioCache(48, async () => { decodes++; return audio(); });
  const controller = new AbortController();
  const read = sharedSignal => { reads++; workSignal = sharedSignal; return new Promise(resolve => { finish = resolve; }); };
  const first = cache.load('shared', read, controller.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = cache.load('shared', read, signal());
  await flush(); controller.abort(); await rejected;
  assert.equal(workSignal.aborted, false);
  finish(new ArrayBuffer(8)); await second;
  assert.equal(reads, 1); assert.equal(decodes, 1); assert.ok(cache.getSnapshot('shared').audio);
  cache.clear();
});

test('a hung read times out and does not prevent the next independent artifact', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cache = new MusicAudioCache(48, async () => audio());
  const hung = cache.load('hung', () => new Promise(() => {}), signal());
  const rejected = assert.rejects(hung, { name: 'TimeoutError' });
  await flush();
  const next = cache.load('next', async () => new ArrayBuffer(8), signal());
  t.mock.timers.tick(30_000); await rejected; await next;
  assert.equal(cache.getSnapshot('hung'), undefined); assert.ok(cache.getSnapshot('next').audio);
  cache.clear();
});

test('discarding a hung artifact releases waiting consumers and the next read', async () => {
  const cache = new MusicAudioCache(48, async () => audio());
  const hung = cache.load('discarded', () => new Promise(() => {}), signal());
  const rejected = assert.rejects(hung, { name: 'AbortError' });
  await flush(); cache.remove('discarded'); await rejected;
  await cache.load('next', async () => new ArrayBuffer(8), signal());
  assert.ok(cache.getSnapshot('next').audio); cache.clear();
});

test('an already running browser decode stays serial while its canceled result is discarded', async () => {
  let finishDecode; const calls = [];
  const cache = new MusicAudioCache(48, bytes => {
    const id = new Uint8Array(bytes)[0]; calls.push(`decode:${id}`);
    return id === 1 ? new Promise(resolve => { finishDecode = resolve; }) : Promise.resolve(audio());
  });
  const firstController = new AbortController();
  const first = cache.load('first', async () => Uint8Array.of(1).buffer, firstController.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await flush(); firstController.abort(); await rejected;
  const next = cache.load('next', async () => { calls.push('read:next'); return Uint8Array.of(2).buffer; }, signal());
  await flush(); assert.deepEqual(calls, ['decode:1']);
  finishDecode(audio()); await next;
  assert.deepEqual(calls, ['decode:1', 'read:next', 'decode:2']);
  assert.equal(cache.getSnapshot('first'), undefined); cache.clear();
});

test('coalesced playback and waveform consumers decode once; LRU audio is bounded and leaves peaks', async () => {
  let decodes=0, reads=0;
  const cache = new MusicAudioCache(48,async()=>{decodes++;return audio();});
  const read = async()=>{reads++;return new ArrayBuffer(8);};
  const [a,b] = await Promise.all([cache.load('a',read,signal()),cache.load('a',read,signal())]);
  assert.equal(a,b);assert.equal(decodes,1);assert.equal(reads,1);
  cache.pin('a');await cache.load('b',read,signal());await cache.load('c',read,signal());
  assert.equal(cache.residentBytes,48);assert.ok(cache.getSnapshot('a').audio);assert.equal(cache.getSnapshot('b').audio,undefined);assert.equal(cache.getSnapshot('b').peaks.length,256);
  cache.clear();assert.equal(cache.residentBytes,0);assert.equal(cache.getSnapshot('a'),undefined);
});
test('clearing a project prevents late media from populating its cache', async()=>{
  let finish;const cache=new MusicAudioCache(48,async()=>audio());
  const pending=cache.load('late',()=>new Promise(resolve=>{finish=resolve;}),signal());
  await Promise.resolve();cache.clear();finish(new ArrayBuffer(8));
  await assert.rejects(pending,{name:'AbortError'});assert.equal(cache.residentBytes,0);
});
test('a captured author action survives failed decoding; observation recovers the same Job and adopts owned media', async () => {
  // Contract fault injection only; actual models and native App acceptance run separately.
  let state = { project: { schemaVersion: 2, projectId: 'project', createdAt: 1, brief: null, lyrics: null,
    takes: [], scores: [], selectedScoreId: null, selectedTakeId: null, comparedTakeIds: [null, null] }, readiness: { runtimeStatus: 'ready' }, activeJobs: {} };
  const reference = { projectId: 'project', clientSubmissionId: 'author-action', jobId: 'completed-job', title: 'Song', promptSnapshot: 'A bright song',
    lyricsSnapshot: 'The real words', targetDurationSeconds: 20, creationMode: 'sketch', createdAt: 1 };
  state = overtoneReducer(state, { type: 'result/remember', result: reference, projectId: 'project' });
  const calls = []; let fail = true; const assets = new Map();
  const cache = new MusicAudioCache(128, async () => { if (fail) throw Error('decode failed'); return { duration: .001, length: 8, numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; });
  const artifact = { artifactId: 'same-audio', mimeType: 'audio/wav', sizeBytes: 90, sha256: 'a'.repeat(64), bytes: [], durationMs: 1, sampleRateHz: 8000, channels: 1, frameCount: 8, width: 0, height: 0 };
  const job = { jobId: reference.jobId, scenarioType: 'music-generate', status: 'completed', progressPercent: 100, progressCurrentStep: 0,
    progressTotalSteps: 0, reasonCode: 'action-executed', reasonDetail: '', traceId: 'trace', createdAt: null, updatedAt: null, transcriptionText: '', artifacts: [artifact],
    musicGeneration: { mixArtifactId: artifact.artifactId, termination: 'budget-limit', audioInfo: { sampleRateHz: 8000, channels: 1, frameCount: 8, durationMs: 1 } } };
  const client = { ai: { scenarioJobs: { get: async id => { calls.push(['get', id]); return { job }; } } }, storage: { assets: {
    list: async ({ prefix }) => ({ assets: [...assets.values()].filter(a => a.relativePath.startsWith(prefix)), nextCursor: '' }),
    adoptArtifact: async ({ artifactId, relativePath }) => {
      calls.push(['adopt', artifactId]); const asset = { relativePath: relativePath.replace('.asset', '.wav'), mediaType: 'audio/wav', sizeBytes: 90, sha256: 'sha256:' + 'a'.repeat(64) };
      assets.set(asset.relativePath, asset); return asset;
    },
    remove: async path => { assets.delete(path); },
    read: async ({ relativePath }) => ({ asset: assets.get(relativePath), body: { async *[Symbol.asyncIterator]() { yield new Uint8Array(90); } } }),
  } } };
  await assert.rejects(recoverRuntimeMusic({ client, cache, operation: reference, signal: signal() }), /decode failed/);
  assert.equal(state.project.recoverableResults.length, 1); assert.equal(state.project.takes.length, 0); assert.equal(assets.size, 0);
  fail = false;
  const result = await recoverRuntimeMusic({ client, cache, operation: reference, signal: signal() });
  const { take } = createMusicVersion(reference, result);
  state = overtoneReducer(state, { type: 'take/add', take });
  state = overtoneReducer(state, { type: 'take/add', take: { ...take, takeId: 'duplicate' } });
  assert.equal(state.project.takes.length, 1); assert.equal(state.project.recoverableResults.length, 0); assert.equal(assets.size, 1);
  assert.ok(calls.some(([kind]) => kind === 'get'));
  assert.ok(calls.filter(([kind]) => kind === 'get').every(([, id]) => id === 'completed-job'));
  assert.deepEqual(calls.filter(([kind]) => kind === 'adopt'), [['adopt', 'same-audio'], ['adopt', 'same-audio']]);
});

test('text cancellation calls protected cancellation and rejects unfinished output',async()=>{
  const controller=new AbortController();let canceled=0,finish;
  const stream={cancel:async()=>{canceled++;finish?.({done:true});},[Symbol.asyncIterator](){return {next:()=>new Promise(resolve=>{finish=resolve;}),return:async()=>({done:true})};}};
  const task=generateRuntimeText({client:{ai:{text:{streamTurn:async()=>stream}}},input:'Idea',system:'Write',signal:controller.signal});
  await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(task,{name:'AbortError'});assert.ok(canceled>0);
});
test('text waiting deadline cancels the stream, including a stream that opens after the deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let open,canceled=0;
  const task=generateRuntimeText({client:{ai:{text:{streamTurn:()=>new Promise(resolve=>{open=resolve;})}}},input:'Idea',system:'Write'});
  const rejected=assert.rejects(task,{name:'TimeoutError'});t.mock.timers.tick(90_000);await rejected;
  open({cancel:async()=>{canceled++;},async *[Symbol.asyncIterator](){}});await Promise.resolve();assert.equal(canceled,1);
});
test('complete text preserves deltas and partial terminal output is never accepted',async()=>{
  const client={ai:{text:{streamTurn:async()=>({cancel:async()=>{},async *[Symbol.asyncIterator](){yield {type:'delta',text:'A '};yield {type:'delta',text:'song'};yield {type:'completed',finishReason:'stop'};}})}}};
  assert.equal(await generateRuntimeText({client,input:'Idea',system:'Write'}),'A song');
  client.ai.text.streamTurn=async()=>({cancel:async()=>{},async *[Symbol.asyncIterator](){yield {type:'delta',text:'unfinished'};yield {type:'completed',finishReason:'length'};}});
  await assert.rejects(generateRuntimeText({client,input:'Idea',system:'Write'}),/INCOMPLETE/);
});

test('discard invalidates an in-flight media load and cached metadata is still checked',async()=>{
 let finish;const cache=new MusicAudioCache(48,async()=>audio());
 const pending=cache.load('discarded',()=>new Promise(resolve=>{finish=resolve;}),signal());
 await Promise.resolve();cache.remove('discarded');finish(new ArrayBuffer(8));
 await assert.rejects(pending,{name:'AbortError'});assert.equal(cache.getSnapshot('discarded'),undefined);
 await cache.load('checked',async()=>new ArrayBuffer(8),signal(),{mimeType:'audio/wav',sizeBytes:8});
 await assert.rejects(cache.load('checked',async()=>new ArrayBuffer(8),signal(),{mimeType:'audio/mpeg',sizeBytes:8}),/METADATA_CHANGED/);
});

test('a late completed reference cannot populate a different project',()=>{
 const state={project:{projectId:'new-project',takes:[]},activeJobs:{},readiness:{}};
 const result=overtoneReducer(state,{type:'result/remember',projectId:'old-project',result:{jobId:'late'}});
 assert.equal(result.project,state.project);assert.equal(result.project.recoverableResults,undefined);
});
