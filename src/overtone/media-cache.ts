import type { PcmAudioInfo } from '@nimiplatform/kit/core/audio';

export const AUDIO_CACHE_BUDGET_BYTES = 4 * 1024 * 1024;
export const MEDIA_READ_TIMEOUT_MS = 30_000;
export interface CachedAudio { readonly info: PcmAudioInfo; readonly peaks: readonly number[]; readonly mimeType: string; readonly sizeBytes: number; readonly sha256: string }
export interface MediaSnapshot { readonly audio?: CachedAudio; readonly peaks: readonly number[] }
interface PendingAudio { controller: AbortController; consumers: number; settled: boolean; promise: Promise<CachedAudio> }

export function waitForAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => undefined); return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); }
  return new Promise((resolve, reject) => {
    const clean = () => signal.removeEventListener('abort', abort);
    const abort = () => { clean(); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(value => { clean(); resolve(value); }, error => { clean(); reject(error); });
  });
}

// @nimi-authority: rule.overtone.data-model.r005
// Cache format and small waveforms only. Playback uses a protected opaque media URL.
export class MusicAudioCache {
  private snapshots = new Map<string, MediaSnapshot>();
  private pending = new Map<string, PendingAudio>();
  private listeners = new Map<string, Set<() => void>>();
  private queue: Promise<unknown> = Promise.resolve();
  private pinned: string | null = null;
  constructor(readonly budget = AUDIO_CACHE_BUDGET_BYTES) {}
  get residentBytes() { return [...this.snapshots.values()].reduce((n, value) => n + value.peaks.length * 8 + 256, 0); }
  getSnapshot = (id: string): MediaSnapshot | undefined => this.snapshots.get(id);
  subscribe(id: string, listener: () => void) {
    const listeners = this.listeners.get(id) ?? new Set(); listeners.add(listener); this.listeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(id); };
  }
  private emit(id: string) { this.listeners.get(id)?.forEach(listener => listener()); }
  pin(id: string | null) { this.pinned = id; }
  async load(id: string, prepare: (signal: AbortSignal) => Promise<CachedAudio>, signal: AbortSignal,
    expected?: Pick<CachedAudio, 'mimeType' | 'sizeBytes' | 'sha256'>): Promise<CachedAudio> {
    signal.throwIfAborted();
    const verify = (entry: CachedAudio) => {
      if (expected && (expected.sizeBytes !== entry.sizeBytes || expected.mimeType !== entry.mimeType || expected.sha256 !== entry.sha256)) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      return entry;
    };
    const existing = this.snapshots.get(id);
    if (existing?.audio) { verify(existing.audio); this.snapshots.delete(id); this.snapshots.set(id, existing); return existing.audio; }
    let task = this.pending.get(id);
    if (!task) {
      const controller = new AbortController(); const workSignal = controller.signal;
      const work: PendingAudio = { controller, consumers: 0, settled: false, promise: undefined! };
      const run = async () => {
        workSignal.throwIfAborted();
        const timer = setTimeout(() => controller.abort(new DOMException('Audio loading timed out', 'TimeoutError')), MEDIA_READ_TIMEOUT_MS);
        try {
          const entry = verify(await waitForAbort(prepare(workSignal), workSignal)); workSignal.throwIfAborted();
          if (!entry.peaks.length || entry.peaks.length > 256 || entry.peaks.some(value => !Number.isFinite(value) || value < 0)) throw new Error('OVERTONE_WAVEFORM_INVALID');
          const bytes = entry.peaks.length * 8 + 256;
          if (bytes > this.budget) throw new Error('OVERTONE_AUDIO_CACHE_BUSY');
          while (this.residentBytes + bytes > this.budget) {
            const victim = [...this.snapshots.keys()].find(key => key !== this.pinned);
            if (!victim) throw new Error('OVERTONE_AUDIO_CACHE_BUSY');
            this.snapshots.delete(victim); this.emit(victim);
          }
          this.snapshots.set(id, { audio: entry, peaks: entry.peaks }); work.settled = true; this.emit(id); return entry;
        } finally { clearTimeout(timer); }
      };
      work.promise = this.queue.then(run).finally(() => { work.settled = true; if (this.pending.get(id) === work) this.pending.delete(id); });
      this.queue = work.promise.catch(() => undefined); this.pending.set(id, work); task = work;
    }
    const work = task; work.consumers += 1; let released = false;
    const release = () => {
      if (released) return; released = true; work.consumers -= 1;
      if (!work.consumers && !work.settled) { if (this.pending.get(id) === work) this.pending.delete(id); work.controller.abort(); }
    };
    signal.addEventListener('abort', release, { once: true });
    try { return verify(await waitForAbort(work.promise, AbortSignal.any([signal, work.controller.signal]))); }
    finally { signal.removeEventListener('abort', release); release(); }
  }
  remove(id: string) { this.pending.get(id)?.controller.abort(); this.pending.delete(id); this.snapshots.delete(id); this.emit(id); }
  clear() {
    this.pending.forEach(work => work.controller.abort()); const ids = [...this.snapshots.keys()];
    this.snapshots.clear(); this.pending.clear(); this.pinned = null; ids.forEach(id => this.emit(id));
  }
}
