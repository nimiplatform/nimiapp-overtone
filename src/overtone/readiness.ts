// Readiness probes. Authority: .nimi/spec/overtone/kernel/workflow-contract.md
// (OVT-FLOW-01) and .nimi/spec/overtone/kernel/runtime-integration-contract.md
// (OVT-RT-06).

import type { NimiClient } from '@nimiplatform/sdk';
import { isNimiRealmExpectedAnonymousSessionError } from '@nimiplatform/sdk/realm';
import {
  createNimiRuntimeRouteOptionsHostDeps,
  listNimiRuntimeRouteOptionsWithHost,
  type NimiRuntimeCanonicalCapability,
  type NimiRuntimeRouteOptionsSnapshot,
} from '@nimiplatform/sdk/runtime';
import { getOvertoneNimiClient } from '../shell/auth/runtime-platform.js';
import type { ReadinessSnapshot } from './types.js';

const READY_TIMEOUT_MS = 5_000;

type ConnectorModelMatch = {
  connectorId: string;
  modelId: string;
};

function normalizeRouteText(value: unknown): string {
  return String(value || '').trim();
}

function pickCloudModel(snapshot: NimiRuntimeRouteOptionsSnapshot): ConnectorModelMatch | undefined {
  const selectedModel = normalizeRouteText(snapshot.selected?.model || snapshot.selected?.modelId);
  const selectedConnectorId = normalizeRouteText(snapshot.selected?.connectorId);
  if (snapshot.selected?.source === 'cloud' && selectedConnectorId && selectedModel) {
    return {
      connectorId: selectedConnectorId,
      modelId: selectedModel,
    };
  }
  const candidates = snapshot.connectors.flatMap((connector) =>
    connector.models
      .map((model) => ({
        connectorId: normalizeRouteText(connector.id),
        modelId: normalizeRouteText(model),
      }))
      .filter((candidate) => candidate.connectorId && candidate.modelId),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

async function findRouteModel(
  client: NimiClient,
  capability: NimiRuntimeCanonicalCapability,
): Promise<ConnectorModelMatch | undefined> {
  const snapshot = await listNimiRuntimeRouteOptionsWithHost(
    { capability },
    createNimiRuntimeRouteOptionsHostDeps(client.runtime),
  );
  return pickCloudModel(snapshot);
}

export async function probeReadiness(): Promise<ReadinessSnapshot> {
  const snapshot: ReadinessSnapshot = {
    runtimeStatus: 'checking',
    textConnectorAvailable: false,
    musicConnectorAvailable: false,
    realmConfigured: detectRealmConfigured(),
    realmAuthenticated: false,
  };

  let client;
  try {
    client = getOvertoneNimiClient();
  } catch (error) {
    return {
      ...snapshot,
      runtimeStatus: 'unavailable',
      runtimeErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const runtime = client.runtime;

  try {
    await runtime.ready({ timeoutMs: READY_TIMEOUT_MS });
  } catch (error) {
    return {
      ...snapshot,
      runtimeStatus: 'unavailable',
      runtimeErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  let scenarioErrorMessage: string | undefined;
  try {
    await runtime.ai.listScenarioProfiles({ modelId: '' });
  } catch (error) {
    scenarioErrorMessage = error instanceof Error ? error.message : String(error);
  }

  let textMatch: ConnectorModelMatch | undefined;
  let musicMatch: ConnectorModelMatch | undefined;

  try {
    [textMatch, musicMatch] = await Promise.all([
      findRouteModel(client, 'text.generate'),
      findRouteModel(client, 'music.generate'),
    ]);
  } catch (error) {
    return {
      ...snapshot,
      runtimeStatus: 'degraded',
      runtimeErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  const realmAuthenticated = await probeRealmAuthenticated(client, snapshot.realmConfigured);

  return {
    ...snapshot,
    runtimeStatus: scenarioErrorMessage ? 'degraded' : 'ready',
    runtimeErrorMessage: scenarioErrorMessage,
    textConnectorAvailable: Boolean(textMatch),
    musicConnectorAvailable: Boolean(musicMatch),
    selectedTextConnectorId: textMatch?.connectorId,
    selectedTextModelId: textMatch?.modelId,
    selectedMusicConnectorId: musicMatch?.connectorId,
    selectedMusicModelId: musicMatch?.modelId,
    realmAuthenticated,
  };
}

async function probeRealmAuthenticated(client: NimiClient, realmConfigured: boolean): Promise<boolean> {
  if (!realmConfigured || !client.realm) return false;
  try {
    await client.realm.me({ timeoutMs: READY_TIMEOUT_MS });
    return true;
  } catch (error) {
    if (isNimiRealmExpectedAnonymousSessionError(error)) return false;
    throw error;
  }
}

function detectRealmConfigured(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  return Boolean(env.VITE_NIMI_REALM_BASE_URL);
}
