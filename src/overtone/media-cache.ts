export const AUDIO_CACHE_BUDGET_BYTES = 256 * 1024 * 1024;
export const MAX_DECODED_AUDIO_BYTES = 128 * 1024 * 1024;
export const MEDIA_READ_TIMEOUT_MS = 30_000;
export interface CachedAudio { bytes: ArrayBuffer; decoded: AudioBuffer; peaks: readonly number[]; mimeType?: string }
export interface MediaSnapshot { audio?: CachedAudio; peaks: readonly number[] }
interface PendingAudio {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: Promise<CachedAudio>;
}

export function audioPeaks(buffer: AudioBuffer): number[] {
  const peaks = Array<number>(256).fill(0);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const bucket = Math.min(255, Math.floor(i * 256 / data.length));
      peaks[bucket] = Math.max(peaks[bucket]!, Math.abs(data[i]!));
    }
  }
  return peaks;
}

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
// Renderer media cache only. Runtime retains canonical artifact ownership.
export class MusicAudioCache {
  private snapshots = new Map<string, MediaSnapshot>();
  private audio = new Map<string, CachedAudio>();
  private pending = new Map<string, PendingAudio>();
  private listeners = new Map<string, Set<() => void>>();
  private queue: Promise<unknown> = Promise.resolve();
  private pinned: string | null = null;
  constructor(readonly budget = AUDIO_CACHE_BUDGET_BYTES,
    private decode = (bytes: ArrayBuffer) => new OfflineAudioContext(1, 1, 48000).decodeAudioData(bytes)) {}
  get residentBytes() {
    return [...this.audio.values()].reduce((total, entry) => total + entry.bytes.byteLength + entry.decoded.length * entry.decoded.numberOfChannels * 4, 0);
  }
  getSnapshot = (id: string): MediaSnapshot | undefined => this.snapshots.get(id);
  subscribe(id: string, listener: () => void) {
    const listeners = this.listeners.get(id) ?? new Set();
    listeners.add(listener); this.listeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(id); };
  }
  private emit(id: string) { this.listeners.get(id)?.forEach(listener => listener()); }
  pin(id: string | null) { this.pinned = id; }
  private touch(id: string, entry: CachedAudio) { this.audio.delete(id); this.audio.set(id, entry); }
  async load(id: string, read: (signal: AbortSignal) => Promise<ArrayBuffer>, signal: AbortSignal, expected?: { mimeType: string; sizeBytes: number }): Promise<CachedAudio> {
    signal.throwIfAborted();
    const existing = this.audio.get(id);
    if (existing) {
      if (expected && (expected.sizeBytes !== existing.bytes.byteLength || expected.mimeType !== existing.mimeType)) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      this.touch(id, existing); return existing;
    }
    let task = this.pending.get(id);
    if (!task) {
      const controller = new AbortController();
      const workSignal = controller.signal;
      const work: PendingAudio = { controller, consumers: 0, settled: false, promise: undefined! };
      const run = async () => {
        workSignal.throwIfAborted();
        const timer = setTimeout(() => controller.abort(new DOMException('Audio loading timed out', 'TimeoutError')), MEDIA_READ_TIMEOUT_MS);
        let bytes: ArrayBuffer;
        try {
          // The protected read has no transport cancellation. Stop waiting and ignore
          // its late result when nobody needs it; it must not hold up the next take.
          bytes = await waitForAbort(read(workSignal), workSignal);
        } finally { clearTimeout(timer); }
        workSignal.throwIfAborted();
        // Browser decoding cannot be interrupted. Keep this part serial even after
        // cancellation so abandoned decodes cannot multiply the working audio memory.
        const decoded = await this.decode(bytes.slice(0));
        workSignal.throwIfAborted();
        const decodedBytes = decoded.length * decoded.numberOfChannels * 4;
        if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decodedBytes > MAX_DECODED_AUDIO_BYTES
          || decodedBytes + bytes.byteLength > this.budget) throw new Error('OVERTONE_AUDIO_TOO_LARGE');
        const entry = { bytes, decoded, peaks: audioPeaks(decoded), mimeType: expected?.mimeType };
        while (this.residentBytes + bytes.byteLength + decodedBytes > this.budget) {
          const victim = [...this.audio.keys()].find(key => key !== this.pinned);
          if (!victim) throw new Error('OVERTONE_AUDIO_CACHE_BUSY');
          const old = this.audio.get(victim)!;
          this.audio.delete(victim); this.snapshots.set(victim, { peaks: old.peaks }); this.emit(victim);
        }
        this.touch(id, entry); this.snapshots.set(id, { audio: entry, peaks: entry.peaks }); work.settled = true; this.emit(id);
        return entry;
      };
      work.promise = this.queue.then(run).finally(() => {
        work.settled = true;
        if (this.pending.get(id) === work) this.pending.delete(id);
      });
      this.queue = work.promise.catch(() => undefined);
      this.pending.set(id, work);
      task = work;
    }
    const work = task;
    work.consumers += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      work.consumers -= 1;
      if (!work.consumers && !work.settled) {
        if (this.pending.get(id) === work) this.pending.delete(id);
        work.controller.abort();
      }
    };
    signal.addEventListener('abort', release, { once: true });
    try {
      const result = await waitForAbort(work.promise, AbortSignal.any([signal, work.controller.signal]));
      if (expected && (expected.sizeBytes !== result.bytes.byteLength || expected.mimeType !== result.mimeType)) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      return result;
    } finally { signal.removeEventListener('abort', release); release(); }
  }
  remove(id: string) {
    this.pending.get(id)?.controller.abort();
    this.pending.delete(id); this.audio.delete(id); this.snapshots.delete(id); this.emit(id);
  }
  clear() {
    this.pending.forEach(work => work.controller.abort());
    const ids = [...this.snapshots.keys()];
    this.audio.clear(); this.snapshots.clear(); this.pending.clear(); this.pinned = null;
    ids.forEach(id => this.emit(id));
  }
}
