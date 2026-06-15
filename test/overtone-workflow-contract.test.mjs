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
const overtoneCssSource = readFileSync(new URL('../src/overtone/overtone.css', import.meta.url), 'utf8');
const mainSource = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const devPreviewSource = readFileSync(new URL('../src/dev-preview.tsx', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../nimi.app.yaml', import.meta.url), 'utf8');
const runtimeAccountCallerContract = readFileSync(new URL('../.nimi/spec/overtone/kernel/tables/runtime-account-caller.yaml', import.meta.url), 'utf8');
const overviewContract = readFileSync(new URL('../.nimi/spec/overtone/overtone.md', import.meta.url), 'utf8');

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
  assert.match(manifest, /scope: ai\.spend\.meter/);
  assert.match(manifest, /scope: ai_profile\.selection\.consume/);
  assert.match(manifest, /scope: data\.scope\.write/);
  assert.match(manifest, /scope: file\.read\.scoped/);
  assert.match(manifest, /scope: file\.write\.scoped/);
});

test('overtone identity authority never uses legacy app-prefixed ids', () => {
  assert.match(runtimeAccountCallerContract, /app_id: nimi\.overtone/);
  assert.match(runtimeAccountCallerContract, /app_instance_id: nimi\.overtone\.local-developer/);
  assert.match(runtimeAccountCallerContract, /ACCOUNT_CALLER_MODE_LOCAL_DEVELOPER_APP/);
  assert.doesNotMatch(runtimeAccountCallerContract, /app\.nimi\.overtone/);
  assert.doesNotMatch(overviewContract, /app\.nimi\.overtone/);
});

test('renderer uses Kit base accent with app-owned Overtone variables', () => {
  assert.match(mainSource, /accentPack="nimi-accent"/);
  assert.match(devPreviewSource, /accentPack="nimi-accent"/);
  assert.match(stylesSource, /@import "@nimiplatform\/kit\/ui\/themes\/nimi-accent\.css"/);
  assert.doesNotMatch(stylesSource, /@nimiplatform\/kit\/ui\/themes\/overtone-accent\.css/);
  assert.match(workspaceSource, /import '\.\/overtone\.css'/);
  assert.match(overtoneCssSource, /--overtone-accent-primary:\s*#8b5cf6/);
  assert.match(overtoneCssSource, /--nimi-action-primary-bg:\s*var\(--overtone-accent-primary\)/);
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

test('local drafts persist only project metadata, not audio buffers', () => {
  assert.match(storeSource, /nimi\.overtone:workspace\.v1/);
  assert.match(storeSource, /localStorage\.setItem/);
  assert.doesNotMatch(storeSource, /JSON\.stringify\(\{ project, audioBuffers/);
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
  assert.match(runtimeWorkflowSource, /requires a MIME type/);
  assert.doesNotMatch(iterationSource, /sourceMimeType: 'audio\/mpeg'/);
});

test('music generation consumes Kit RuntimeGenerationPanel lifecycle before artifact projection', () => {
  assert.match(generateSource, /useRuntimeGenerationPanel/);
  assert.match(generateSource, /RuntimeGenerationPanel/);
  assert.match(iterationSource, /useRuntimeGenerationPanel/);
  assert.match(iterationSource, /RuntimeGenerationPanel/);
  assert.match(runtimeWorkflowSource, /buildMusicGenerateScenarioRequest/);
  assert.match(runtimeWorkflowSource, /ScenarioType\.MUSIC_GENERATE/);
  assert.match(runtimeWorkflowSource, /ExecutionMode\.ASYNC_JOB/);
  assert.doesNotMatch(generateSource + iterationSource, /submitMusicGenerate/);
});

test('readiness probes scenario profiles before route option matching', () => {
  assert.match(readinessSource, /runtime\.ai\.listScenarioProfiles\(\{ modelId: '' \}\)/);
  assert.match(readinessSource, /listNimiRuntimeRouteOptionsWithHost/);
});

test('realm authentication readiness is unavailable without a platform publish proxy', () => {
  assert.match(readinessSource, /realmConfigured:\s*false/);
  assert.match(readinessSource, /realmAuthenticated:\s*false/);
  assert.doesNotMatch(readinessSource, /getRuntimeSubjectUserId/);
  assert.doesNotMatch(readinessSource, /realm\.me\(/);
  assert.doesNotMatch(readinessSource, /isNimiRealmExpectedAnonymousSessionError/);
});

test('readiness does not silently choose the first route candidate', () => {
  assert.match(readinessSource, /candidates\.length === 1/);
  assert.doesNotMatch(readinessSource, /\.find\(\(item\) => item\.models\.length > 0\)/);
});

test('iteration panel creates child takes through app-owned extension builder', () => {
  assert.match(workspaceSource, /IterationPanel/);
  assert.match(iterationSource, /buildMusicIterationExtensions/);
  assert.match(iterationSource, /Reference audio/);
  assert.match(iterationSource, /type="file"/);
  assert.match(iterationSource, /origin: mode/);
});

test('publish flow fails closed without raw Realm token transport', () => {
  assert.doesNotMatch(publishSource, /uploadNimiRealmResourceFile/);
  assert.doesNotMatch(publishSource, /createNimiRealmPost/);
  assert.doesNotMatch(publishSource, /requireRealm\(/);
  assert.match(publishSource, /Realm publishing is unavailable for developer-registered local apps/);
  assert.match(publishSource, /provenanceConfirmed/);
  assert.doesNotMatch(publishSource, /type: 'audio\/mpeg'/);
});

test('completed runtime artifacts fail-close before take creation', () => {
  assert.match(typesSource, /artifactMimeType: string/);
  assert.match(typesSource, /artifactByteLength: number/);
  assert.match(runtimeWorkflowSource, /requireCompletedMusicArtifact/);
  assert.match(generateSource, /requireCompletedMusicArtifact/);
  assert.match(iterationSource, /requireCompletedMusicArtifact/);
});

test('ids use SDK client ids rather than Date plus random ids', () => {
  assert.match(typesSource, /createNimiClientId/);
  assert.doesNotMatch(typesSource, /Math\.random/);
  assert.doesNotMatch(runtimeWorkflowSource, /Math\.random/);
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

test('player and takes expose trim preview plus A/B compare surfaces', () => {
  assert.match(playerSource, /trimStartSec/);
  assert.match(playerSource, /overtone-trim-controls/);
  assert.match(takesSource, /A\/B Compare/);
  assert.match(takesSource, /overtone-compare__grid/);
});
