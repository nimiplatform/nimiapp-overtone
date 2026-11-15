import { useEffect } from 'react';
import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';
import { probeReadiness } from './readiness.js';
import type { ReadinessSnapshot } from './types.js';

// @nimi-authority: rule.overtone.auth.r005
export function useReadiness(
  client: NimiAppRuntimeClient,
  signal: AbortSignal,
  setReadiness: (snapshot: ReadinessSnapshot) => void,
  reloadKey: number,
) {
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const refresh = () => {
      if (cancelled || signal.aborted) return;
      const current = ++revision;
      const isCurrent = () => !cancelled && !signal.aborted && current === revision;
      void probeReadiness(client, signal)
        .then((snapshot) => { if (isCurrent()) setReadiness(snapshot); })
        .catch((error) => {
          if (isCurrent()) {
            setReadiness({
              runtimeStatus: 'unavailable',
              runtimeErrorMessage: error instanceof Error ? error.message : String(error),
              textCapabilityAvailable: false,
              musicCapabilityAvailable: false,
            });
          }
        });
    };
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [reloadKey, setReadiness, client, signal]);
}
