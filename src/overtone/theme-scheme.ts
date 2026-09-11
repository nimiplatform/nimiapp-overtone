import type { NimiThemeScheme } from '@nimiplatform/kit/ui';

// Renderer-local display preference only; not Runtime/Realm truth. Mirrors the
// locale persistence style in i18n.ts.
const OVERTONE_SCHEME_STORAGE_KEY = 'nimi.overtone:scheme.v1';

export function resolveInitialOvertoneScheme(): NimiThemeScheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(OVERTONE_SCHEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // The scheme is a renderer-local display preference; failure falls back to light.
  }
  return 'light';
}

export function persistOvertoneScheme(scheme: NimiThemeScheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERTONE_SCHEME_STORAGE_KEY, scheme);
  } catch {
    // Display preference persistence is best-effort and must not block product usage.
  }
}
