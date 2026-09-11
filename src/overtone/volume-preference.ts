// Renderer-local playback volume preference (0-100). App-owned device preference only:
// not draft metadata, not Runtime/Realm truth. Mirrors the locale/scheme
// persistence style.
const OVERTONE_VOLUME_STORAGE_KEY = 'nimi.overtone:volume.v1';
const DEFAULT_VOLUME = 80;

export function resolveInitialOvertoneVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  try {
    const stored = window.localStorage.getItem(OVERTONE_VOLUME_STORAGE_KEY);
    if (stored !== null) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) return clampVolume(parsed);
    }
  } catch {
    // The volume is a renderer-local preference; failure falls back to the default.
  }
  return DEFAULT_VOLUME;
}

export function persistOvertoneVolume(volume: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OVERTONE_VOLUME_STORAGE_KEY, String(clampVolume(volume)));
  } catch {
    // Volume persistence is best-effort and must not block playback.
  }
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
