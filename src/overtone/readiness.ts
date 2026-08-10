// Readiness is derived only from the protected Local App session and portable
// App AIConfig. The current App Access contract does not expose music jobs.

import { getNimiLocalAppClient } from '../shell/auth/local-app-client.js';
import type { ReadinessSnapshot } from './types.js';

export async function probeReadiness(): Promise<ReadinessSnapshot> {
  const base: ReadinessSnapshot = {
    runtimeStatus: 'checking',
    textCapabilityAvailable: false,
    musicCapabilityAvailable: false,
    realmConfigured: false,
    realmAuthenticated: false,
  };

  try {
    const client = getNimiLocalAppClient();
    const status = await client.auth.status();
    if (!status.sessionBound) {
      return {
        ...base,
        runtimeStatus: 'unavailable',
        runtimeErrorMessage: status.reasonCode,
      };
    }
    const config = await client.aiConfig.get();
    const textConfigured = config.capabilities.some(
      (capability) => capability.capabilityContract === 'text.generate',
    );
    return {
      ...base,
      runtimeStatus: 'ready',
      textCapabilityAvailable: textConfigured,
    };
  } catch (error) {
    return {
      ...base,
      runtimeStatus: 'unavailable',
      runtimeErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
