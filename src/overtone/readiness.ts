// Readiness probes. Authority: .nimi/spec/overtone/kernel/workflow-contract.md
// (OVT-FLOW-01) and .nimi/spec/overtone/kernel/runtime-integration-contract.md
// (OVT-RT-06).

import type { NimiClient } from '@nimiplatform/sdk';
import {
  createNimiRuntimeRouteOptionsHostDeps,
  isNimiRuntimeTargetInventoryItemSelectable,
  listNimiRuntimeRouteOptionsWithHost,
  type NimiRuntimeCanonicalCapability,
  type NimiRuntimeRouteCloudTargetRef,
  type NimiRuntimeRouteOptionsSnapshot,
  type NimiRuntimeTargetInventoryItem,
} from '@nimiplatform/sdk/runtime';
import { getRuntimeNimiClient } from '../shell/auth/runtime-platform.js';
import type { ReadinessSnapshot } from './types.js';

const READY_TIMEOUT_MS = 5_000;

type ConnectorModelMatch = {
  connectorId: string;
  modelId: string;
  targetRef: NimiRuntimeRouteCloudTargetRef;
};

function normalizeRouteText(value: unknown): string {
  return String(value || '').trim();
}

function routeCloudTargetRefsEqual(
  left: NimiRuntimeRouteCloudTargetRef,
  right: NimiRuntimeRouteCloudTargetRef,
): boolean {
  return left.connectorId === right.connectorId &&
    left.remoteModelCatalogId === right.remoteModelCatalogId &&
    left.providerModelId === right.providerModelId &&
    (left.provider || '') === (right.provider || '');
}

function cloudInventoryItemToMatch(item: NimiRuntimeTargetInventoryItem): ConnectorModelMatch | null {
  if (item.targetRef.kind !== 'cloud-connector') {
    return null;
  }
  const connectorId = normalizeRouteText(item.targetRef.connectorId);
  const modelId = normalizeRouteText(item.targetRef.providerModelId);
  const remoteModelCatalogId = normalizeRouteText(item.targetRef.remoteModelCatalogId);
  if (!connectorId || !modelId || !remoteModelCatalogId || !isNimiRuntimeTargetInventoryItemSelectable(item)) {
    return null;
  }
  return {
    connectorId,
    modelId,
    targetRef: {
      kind: 'cloud-connector',
      version: 'v2',
      connectorId,
      remoteModelCatalogId,
      providerModelId: modelId,
      ...(item.targetRef.provider ? { provider: item.targetRef.provider } : {}),
    },
  };
}

function pickCloudModel(snapshot: NimiRuntimeRouteOptionsSnapshot): ConnectorModelMatch | undefined {
  const candidates = snapshot.inventory.targets
    .map(cloudInventoryItemToMatch)
    .filter((candidate): candidate is ConnectorModelMatch => candidate !== null);
  const selectedTargetRef = snapshot.selectedTargetRef;
  if (selectedTargetRef?.kind === 'cloud-connector') {
    return candidates.find((candidate) => routeCloudTargetRefsEqual(candidate.targetRef, selectedTargetRef));
  }
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
    realmConfigured: false,
    realmAuthenticated: false,
  };

  let client;
  try {
    client = getRuntimeNimiClient();
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

  return {
    ...snapshot,
    runtimeStatus: scenarioErrorMessage ? 'degraded' : 'ready',
    runtimeErrorMessage: scenarioErrorMessage,
    textConnectorAvailable: Boolean(textMatch),
    musicConnectorAvailable: Boolean(musicMatch),
    selectedTextTargetRef: textMatch?.targetRef,
    selectedMusicTargetRef: musicMatch?.targetRef,
    selectedTextConnectorId: textMatch?.connectorId,
    selectedTextModelId: textMatch?.modelId,
    selectedMusicConnectorId: musicMatch?.connectorId,
    selectedMusicModelId: musicMatch?.modelId,
    realmAuthenticated: false,
  };
}
