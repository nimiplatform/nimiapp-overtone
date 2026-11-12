import { createContext, useContext, type ReactNode } from 'react';
import type { NimiAppScope } from '@nimiplatform/kit/core/app-session';

export type AssetMediaHandle = { readonly url: string; readonly revoke: () => Promise<void> };
export type OvertoneHost = {
  readonly kind: 'desktop' | 'web' | 'mobile';
  openMedia(scope: NimiAppScope, path: string): Promise<AssetMediaHandle>;
  deliver(scope: NimiAppScope, path: string, name: string): Promise<void>;
};
const Context = createContext<{ scope: NimiAppScope; host: OvertoneHost } | null>(null);
export function OvertoneSessionProvider({ scope, host, children }: { scope: NimiAppScope; host: OvertoneHost; children: ReactNode }) {
  return <Context.Provider value={{ scope, host }}>{children}</Context.Provider>;
}
export function useOvertoneSession() { const value = useContext(Context); if (!value) throw new Error('OvertoneSessionProvider required'); return value; }
