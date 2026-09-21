import React from 'react';
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
export function ComponentHarness({ observe, storage }: { observe: (value: unknown) => void; storage: Pick<NimiLocalAppClient['storage'], 'readJson' | 'writeJson'> }) {
  return <OvertoneProvider storage={storage}><ExplorationProvider><Capture observe={observe}/><GeneratePanel/><PlayerPanel/><DraftSaveNotice/></ExplorationProvider></OvertoneProvider>;
}
