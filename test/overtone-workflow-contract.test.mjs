import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const productAreaSource = readFileSync(new URL('../src/shell/routes/product-area.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('../src/overtone/workspace-page.tsx', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/overtone/store.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../src/overtone/types.ts', import.meta.url), 'utf8');
const runtimeWorkflowSource = readFileSync(new URL('../src/overtone/runtime-workflow.ts', import.meta.url), 'utf8');
const readinessSource = readFileSync(new URL('../src/overtone/readiness.ts', import.meta.url), 'utf8');
const briefSource = readFileSync(new URL('../src/overtone/panels/brief-panel.tsx', import.meta.url), 'utf8');
const generateSource = readFileSync(new URL('../src/overtone/panels/generate-panel.tsx', import.meta.url), 'utf8');
const iterationSource = readFileSync(new URL('../src/overtone/panels/iteration-panel.tsx', import.meta.url), 'utf8');
const publishSource = readFileSync(new URL('../src/overtone/panels/publish-panel.tsx', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../src/overtone/panels/player-panel.tsx', import.meta.url), 'utf8');
const takesSource = readFileSync(new URL('../src/overtone/panels/takes-panel.tsx', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');

const allSource = [
  productAreaSource,
  workspaceSource,
  storeSource,
  typesSource,
  runtimeWorkflowSource,
  readinessSource,
  briefSource,
  generateSource,
  iterationSource,
  publishSource,
  playerSource,
  takesSource,
].join('\n');

test('product-area mounts Overtone workspace, not tester', () => {
  assert.match(productAreaSource, /WorkspacePage/);
  assert.doesNotMatch(productAreaSource, /TesterWorkbench/);
  assert.doesNotMatch(productAreaSource, /WorldTourViewerRoute/);
});

test('manifest declares overtone app identity and runtime scopes', () => {
  assert.match(manifest, /app_id: nimi\.overtone/);
  assert.match(manifest, /display_name: Nimi Overtone/);
  assert.match(manifest, /runtime\.ai\.music\.generate/);
  assert.match(manifest, /runtime\.ai\.text\.stream/);
  assert.match(manifest, /realm\.resources\.publish/);
});

test('renderer uses the overtone-accent kit theme', () => {
  assert.match(mainSource, /accentPack="overtone-accent"/);
  assert.match(stylesSource, /@import "@nimiplatform\/kit\/ui\/themes\/overtone-accent\.css"/);
});

test('workspace and panels source has no app-owned token custody', () => {
  assert.doesNotMatch(allSource, /authToken|authRefreshToken/);
  assert.doesNotMatch(allSource, /applyToken|persistSession|persistSharedDesktopAuthSession/);
  assert.doesNotMatch(allSource, /VITE_NIMI_REALM_ACCESS_TOKEN/);
});

test('workspace and panels do not import runtime/internal or @renderer/ aliases', () => {
  assert.doesNotMatch(allSource, /from ['"]runtime\/internal/);
  assert.doesNotMatch(allSource, /from ['"]@renderer\//);
  assert.doesNotMatch(allSource, /from ['"]@runtime\//);
});

test('takes are append-only — store does not splice or pop the take list', () => {
  assert.doesNotMatch(storeSource, /takes\.splice|takes\.pop|takes\.shift/);
});

test('discarding a take clears its in-memory audio buffer', () => {
  assert.match(storeSource, /case 'take\/discard'/);
  assert.match(storeSource, /audioBuffers/);
  assert.match(storeSource, /\[action\.takeId\]/);
});

test('publish draft creation resets stale publish state', () => {
  assert.match(storeSource, /publishDraftFromTake/);
  assert.match(storeSource, /type: 'publish\/status', status: 'idle'/);
  assert.match(storeSource, /type: 'publish\/post-id', postId: null/);
});

test('music iteration extension namespace stays nimi.scenario.music_generate.request', () => {
  assert.match(runtimeWorkflowSource, /nimi\.scenario\.music_generate\.request/);
});

test('music generation uses job subscription before artifact resolution', () => {
  assert.match(runtimeWorkflowSource, /media\.jobs\.submit/);
  assert.match(runtimeWorkflowSource, /media\.jobs\.subscribe/);
  assert.match(runtimeWorkflowSource, /media\.jobs\.getArtifacts/);
});

test('readiness probes scenario profiles before connector/model matching', () => {
  assert.match(readinessSource, /runtime\.ai\.listScenarioProfiles\(\{ modelId: '' \}\)/);
});

test('iteration panel creates child takes through app-owned extension builder', () => {
  assert.match(workspaceSource, /IterationPanel/);
  assert.match(iterationSource, /buildMusicIterationExtensions/);
  assert.match(iterationSource, /parentTakeId: sourceTake\.takeId/);
  assert.match(iterationSource, /origin: mode/);
});

test('publish flow uses realm direct upload + finalizeResource + createPost', () => {
  assert.match(publishSource, /createAudioDirectUpload/);
  assert.match(publishSource, /finalizeResource/);
  assert.match(publishSource, /createPost/);
  assert.match(publishSource, /provenanceConfirmed/);
});

test('removed surface names do not reappear in active source', () => {
  const removed = [
    'TesterWorkbench',
    'kit-component-gallery',
    'world-tour-viewer',
    'ProjectPicker',
    'WorkspaceTabs',
    'ChatPanel',
    'AgentSupervisorPanel',
    'AutonomousLoopRunner',
    'ModRuntimeConsole',
    'DatasetConsole',
    'BatchImportPanel',
  ];
  for (const name of removed) {
    assert.doesNotMatch(allSource, new RegExp(name), `removed surface ${name} reappeared in active source`);
  }
});

test('SongTake origin enum admits only spec-listed values', () => {
  assert.match(typesSource, /type TakeOrigin = 'prompt' \| 'extend' \| 'remix' \| 'reference'/);
});

test('workspace does not skip readiness probe', () => {
  assert.match(workspaceSource, /probeReadiness/);
  assert.match(workspaceSource, /runtimeStatus === 'unavailable'/);
});

test('escape key exits compare mode when publish modal is not open', () => {
  assert.match(workspaceSource, /event\.key === 'Escape'/);
  assert.match(workspaceSource, /clearCompare\(\)/);
  assert.match(workspaceSource, /publishTakeId === null/);
});
