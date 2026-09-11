import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const productAreaSource = read('../src/shell/routes/product-area.tsx');
const localAppClientSource = read('../src/shell/auth/local-app-client.ts');
const workspaceSource = read('../src/overtone/workspace-page.tsx');
const i18nSource = read('../src/overtone/i18n.ts');
const storeSource = read('../src/overtone/store.tsx');
const typesSource = read('../src/overtone/types.ts');
const runtimeWorkflowSource = read('../src/overtone/runtime-workflow.ts');
const readinessSource = read('../src/overtone/readiness.ts');
const briefSource = read('../src/overtone/panels/brief-panel.tsx');
const explorationSource = read('../src/overtone/exploration-context.tsx');
const lyricsSource = read('../src/overtone/panels/lyrics-panel.tsx');
const generateSource = read('../src/overtone/panels/generate-panel.tsx');
const iterationSource = read('../src/overtone/panels/iteration-panel.tsx');
const playerSource = read('../src/overtone/panels/player-panel.tsx');
const takesSource = read('../src/overtone/panels/takes-panel.tsx');
const stylesSource = read('../src/styles.css');
const overtoneCssSource = read('../src/overtone/overtone.css');
const mainSource = read('../src/main.tsx');
const manifest = read('../nimi.app.yaml');
const runtimeAuthority = read('../.nimi/spec/overtone/canonical/runtime.authority.yaml');

const allSource = [
  productAreaSource,
  localAppClientSource,
  workspaceSource,
  i18nSource,
  storeSource,
  typesSource,
  runtimeWorkflowSource,
  readinessSource,
  briefSource,
  explorationSource,
  lyricsSource,
  generateSource,
  iterationSource,
  playerSource,
  takesSource,
].join('\n');

test('product-area mounts Overtone workspace, not tester', () => {
  assert.match(productAreaSource, /WorkspacePage/);
  assert.doesNotMatch(productAreaSource, /TesterWorkbench|WorldTourViewerRoute/);
});

test('manifest declares Overtone identity and current App Access', () => {
  assert.match(manifest, /app_id: nimi\.overtone/);
  assert.match(manifest, /display_name: Nimi Overtone/);
  assert.match(manifest, /app_access:\s*\n\s*- runtime\.consume/);
  assert.doesNotMatch(manifest, /declared_nimi_api_scopes|ai\.spend\.meter|file\.write\.scoped/);
});

test('runtime identity authority is host-bound and has no legacy app-prefixed ids', () => {
  assert.match(runtimeAuthority, /app_id nimi\.overtone/);
  assert.match(runtimeAuthority, /NimiLocalAppClient/);
  assert.match(runtimeAuthority, /Kit host-injected standard shell surface/);
  assert.doesNotMatch(runtimeAuthority, /app\.nimi\.overtone|local-developer|ACCOUNT_CALLER_MODE_LOCAL_DEVELOPER_APP/);
});

test('renderer uses Kit base accent with app-owned Overtone variables', () => {
  assert.match(mainSource, /accentPack="nimi-accent"/);
  assert.match(stylesSource, /@import "@nimiplatform\/kit\/ui\/themes\/nimi-accent\.css"/);
  assert.match(workspaceSource, /import '\.\/overtone\.css'/);
  assert.match(overtoneCssSource, /--nimi-action-primary-bg:\s*var\(--overtone-accent-primary\)/);
});

test('overtone i18n supports English and Chinese through Kit language switcher', () => {
  assert.match(workspaceSource, /SegmentedControl/);
  assert.match(workspaceSource, /onValueChange=\{handleLocaleChange\}/);
  assert.match(workspaceSource, /persistOvertoneLocale/);
  assert.match(i18nSource, /OVERTONE_LOCALES = \['en', 'zh'\]/);
  assert.match(i18nSource, /nimi\.overtone:locale\.v1/);
});

test('workspace has no app-owned token, caller, connector, or model custody', () => {
  assert.doesNotMatch(allSource, /authToken|authRefreshToken|accessToken|refreshToken/);
  assert.doesNotMatch(allSource, /applyToken|persistSession|VITE_NIMI_REALM_ACCESS_TOKEN/);
  assert.doesNotMatch(allSource, /connectorId|modelId|targetRef|RuntimeAccountCaller/);
  assert.doesNotMatch(allSource, /from ['"]runtime\/internal|from ['"]@renderer\/|from ['"]@runtime\//);
});

test('readiness is derived from protected session posture and App AIConfig', () => {
  assert.match(readinessSource, /client\.auth\.status\(\)/);
  assert.match(readinessSource, /client\.aiConfig\.get\(\)/);
  assert.match(readinessSource, /capabilityContract === 'text\.generate'/);
  assert.match(readinessSource, /musicCapabilityAvailable:\s*false/);
  assert.doesNotMatch(readinessSource, /listScenarioProfiles|listNimiRuntimeRouteOptions|inventory\.targets/);
});

test('brief and lyrics assistance use cancelable protected Local App text streams', () => {
  assert.match(runtimeWorkflowSource, /client\.ai\.text\.streamTurn\(/);
  assert.match(explorationSource, /getNimiLocalAppClient\(\)/);
  assert.match(lyricsSource, /getNimiLocalAppClient\(\)/);
  assert.match(explorationSource + lyricsSource, /generateRuntimeText\(/);
  assert.doesNotMatch(runtimeWorkflowSource, /ScenarioType|ExecutionMode|runtime\.ai\.|buildMusic/);
});

test('text reinterpretation uses snapshots without an unsupported audio iteration bypass', () => {
  assert.match(explorationSource, /source\.promptSnapshot/);
  assert.match(explorationSource, /source\?\.lyricsSnapshot/);
  assert.match(iterationSource, /Overtone\.playground\.reinterpretHint/);
  assert.doesNotMatch(generateSource + iterationSource, /RuntimeGenerationPanel|useRuntimeGenerationPanel|submitMusicGenerate|requireCompletedMusicArtifact/);
});

test('takes remain append-only and discarding clears in-memory audio', () => {
  assert.doesNotMatch(storeSource, /takes\.splice|takes\.pop|takes\.shift/);
  assert.match(storeSource, /case 'take\/discard'/);
  assert.doesNotMatch(storeSource, /audioBuffers/);
  assert.match(storeSource, /cache\.remove\(take\.artifactId\)/);
});

test('local drafts persist only project metadata, not audio buffers', () => {
  assert.match(storeSource, /nimi\.overtone:workspace\.v1/);
  assert.match(storeSource, /localStorage\.setItem/);
  assert.doesNotMatch(storeSource, /JSON\.stringify\(\{ project, audioBuffers/);
});


test('unavailable publication has no user action or form', () => {
  assert.doesNotMatch(workspaceSource + takesSource, /PublishModal|onPublish|takes\.publish/);
});

test('ids use SDK client ids rather than random ids', () => {
  assert.match(typesSource, /createNimiClientId/);
  assert.doesNotMatch(typesSource + runtimeWorkflowSource, /Math\.random/);
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
  assert.match(typesSource, /type TakeOrigin = 'prompt'/);
});

test('workspace probes readiness and exposes unavailable state', () => {
  assert.match(workspaceSource, /probeReadiness/);
  assert.match(workspaceSource, /runtimeStatus === 'unavailable'/);
  assert.match(workspaceSource, /musicCapabilityAvailable/);
});

test('escape key exits compare mode when no dialog owns it', () => {
  assert.match(workspaceSource, /event\.key === 'Escape'/);
  assert.match(workspaceSource, /clearCompare\(\)/);
  assert.match(workspaceSource, /event\.defaultPrevented/);
});

test('player and takes expose trim preview plus A/B compare surfaces', () => {
  assert.match(playerSource, /trimStartSec/);
  assert.match(playerSource, /overtone-trim-controls/);
  assert.match(takesSource, /compareTitle/);
  assert.match(takesSource, /overtone-compare__grid/);
});
