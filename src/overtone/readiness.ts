// Readiness probes. Authority: .nimi/spec/overtone/kernel/workflow-contract.md
// (OVT-FLOW-01) and .nimi/spec/overtone/kernel/runtime-integration-contract.md
// (OVT-RT-06).

import type { NimiClient } from '@nimiplatform/sdk';
import { isNimiRealmExpectedAnonymousSessionError } from '@nimiplatform/sdk/realm';
import type { Runtime } from '@nimiplatform/sdk/runtime';
import { ConnectorKind, ConnectorStatus } from '@nimiplatform/sdk/runtime/generated';
import { getOvertoneNimiClient } from '../shell/auth/runtime-platform.js';
import type { ReadinessSnapshot } from './types.js';

const READY_TIMEOUT_MS = 5_000;

const TEXT_CAPABILITIES = ['text.stream', 'text.generate'];
const MUSIC_CAPABILITIES = ['music.generate'];

type ConnectorModelMatch = {
  connectorId: string;
  modelId: string;
};

async function findModelWithCapability(
  runtime: Runtime,
  connectorIds: string[],
  capabilities: string[],
): Promise<ConnectorModelMatch | undefined> {
  for (const connectorId of connectorIds) {
    try {
      const response = await runtime.connectors.listConnectorModels({
        connectorId,
        forceRefresh: false,
        pageSize: 50,
        pageToken: '',
      });
      const models = response.models ?? [];
      const match = models.find((model) =>
        model.available && capabilities.some((capability) => model.capabilities.includes(capability)),
      );
      if (match?.modelId) {
        return { connectorId, modelId: match.modelId };
      }
    } catch {
      // skip this connector — it might be unauthenticated or unreachable
    }
  }
  return undefined;
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
    const connectors = await runtime.connectors.listConnectors({
      pageSize: 50,
      pageToken: '',
      kindFilter: ConnectorKind.UNSPECIFIED,
      statusFilter: ConnectorStatus.UNSPECIFIED,
      providerFilter: '',
    });
    const connectorIds = (connectors.connectors ?? [])
      .filter((connector) => connector.status === ConnectorStatus.ACTIVE || connector.status === ConnectorStatus.UNSPECIFIED)
      .map((connector) => connector.connectorId)
      .filter((id): id is string => Boolean(id));

    textMatch = await findModelWithCapability(runtime, connectorIds, TEXT_CAPABILITIES);
    musicMatch = await findModelWithCapability(runtime, connectorIds, MUSIC_CAPABILITIES);
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
