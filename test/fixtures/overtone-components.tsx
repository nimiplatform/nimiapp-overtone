import React, { useMemo } from 'react';
import { OvertoneSessionProvider, type OvertoneHost } from '../../src/shell/auth/app-session.js';
import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';
import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { OvertoneProvider, useOvertoneActions, useOvertonePlayback, useOvertonePersistence, useOvertoneState, useAudioCache } from '../../src/overtone/store.js';
import { PlayerPanel } from '../../src/overtone/panels/player-panel.js';
import { DraftSaveNotice } from '../../src/overtone/panels/draft-save-notice.js';
import { GeneratePanel } from '../../src/overtone/panels/generate-panel.js';
import { ExplorationProvider, useExploration } from '../../src/overtone/exploration-context.js';

function Capture({ observe }: { observe: (value: unknown) => void }) {
  observe({ state: useOvertoneState(), actions: useOvertoneActions(), playback: useOvertonePlayback(),
    persistence: useOvertonePersistence(), cache: useAudioCache(), creative: useExploration() });
  return null;
}
export function ComponentHarness({ observe, storage, openMedia }: { observe: (value: unknown) => void; storage: Pick<NimiLocalAppClient['storage'], 'readJson' | 'writeJson' | 'removeJson' | 'assets'>; openMedia?: React.ComponentProps<typeof PlayerPanel>['openMedia'] }) {
  // Isolated component storage only; AI and real Host/media behavior are not simulated.
  const scope = useMemo(() => ({ client: { storage } as unknown as NimiAppRuntimeClient, signal: new AbortController().signal, viewKey: 'component-unit' }), [storage]);
  const host: OvertoneHost = useMemo(() => ({ kind: 'desktop', async openMedia() { throw new Error('Unit test must supply media'); }, async deliver() { throw new Error('No export in this component unit'); } }), []);
  return <OvertoneSessionProvider scope={scope} host={host}><OvertoneProvider storage={storage}><ExplorationProvider><Capture observe={observe}/><GeneratePanel/><PlayerPanel openMedia={openMedia}/><DraftSaveNotice/></ExplorationProvider></OvertoneProvider></OvertoneSessionProvider>;
}
