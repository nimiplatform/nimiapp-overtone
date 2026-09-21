import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { buildPcmWaveform, createPcmWorkerClient, encodePcmWav, inspectCanonicalWav, PCM_BLOCK_FRAMES, readPcmFrames,
  type CanonicalWav, type PcmAudioInfo } from '@nimiplatform/kit/core/audio';
import type { OwnedAsset, ProjectAudio } from './types.js';
import { waitForAbort } from './media-cache.js';

type MediaClient = Pick<NimiLocalAppClient, 'storage'>;

export type ProjectPcm = CanonicalWav & { readonly dispose: () => Promise<void> };

// @nimi-authority: rule.overtone.data-model.r005
export async function openProjectPcm(client: MediaClient, audio: ProjectAudio, signal: AbortSignal): Promise<ProjectPcm> {
  let iterator: AsyncIterator<Uint8Array> | undefined;
  let cursor = 0; let remainder: Uint8Array = new Uint8Array(0); let disposed = false;
  const closeStream = async () => {
    const current = iterator; iterator = undefined; remainder = new Uint8Array(0);
    if (current?.return) await waitForAbort(Promise.resolve(current.return()), AbortSignal.timeout(30_000));
  };
  const dispose = async () => { if (disposed) return; disposed = true; signal.removeEventListener('abort', abort); await closeStream(); };
  const abort = () => { void dispose().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const wav = await inspectCanonicalWav({ sizeBytes: audio.sizeBytes, read: async (offset, length, readSignal) => {
      const deadline = AbortSignal.any([signal, ...(readSignal ? [readSignal] : []), AbortSignal.timeout(30_000)]);
      const operation = async () => {
        deadline.throwIfAborted(); if (disposed) throw new Error('OVERTONE_PCM_CLOSED');
        if (!iterator || cursor !== offset) {
          await closeStream(); deadline.throwIfAborted();
          // One protected stream pins and verifies the source. Sequential Kit
          // windows consume it with backpressure instead of rehashing the whole song.
          const response = await client.storage.assets.read({ relativePath: audio.relativePath, offset, length: audio.sizeBytes - offset });
          const opened = response.body[Symbol.asyncIterator]();
          if (disposed || deadline.aborted) { void opened.return?.(); deadline.throwIfAborted(); throw new Error('OVERTONE_PCM_CLOSED'); }
          if (response.asset.sha256 !== audio.sha256 || response.asset.sizeBytes !== audio.sizeBytes || response.asset.mediaType !== audio.mimeType
            || response.range.offset !== offset || response.range.length !== audio.sizeBytes - offset || response.range.totalSize !== audio.sizeBytes) {
            void opened.return?.(); throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
          }
          iterator = opened; cursor = offset;
        }
        const bytes = new Uint8Array(length); let received = 0;
        while (received < length) {
          deadline.throwIfAborted();
          if (!remainder.length) {
            const next = await iterator!.next(); deadline.throwIfAborted();
            if (next.done || !next.value.length || next.value.length > 1024 * 1024) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
            remainder = next.value;
          }
          const count = Math.min(length - received, remainder.length);
          bytes.set(remainder.subarray(0, count), received); remainder = remainder.subarray(count);
          received += count; cursor += count;
        }
        if (cursor === audio.sizeBytes) await closeStream();
        return bytes;
      };
      return waitForAbort(operation(), deadline);
    } }, signal);
    if (wav.info.sampleRateHz !== audio.sampleRateHz || wav.info.channels !== audio.channels || wav.info.frameCount !== audio.frameCount) throw new Error('OVERTONE_AUDIO_FACTS_CHANGED');
    return { ...wav, dispose };
  } catch (error) { await dispose(); throw error; }
}

export function projectPcmWorker() {
  return createPcmWorkerClient(new Worker(new URL('./pcm-worker.ts', import.meta.url), { type: 'module' }));
}

export async function projectWaveform(client: MediaClient, audio: ProjectAudio, signal: AbortSignal,
  onProgress?: (completedFrames: number, totalFrames: number) => void) {
  const wav = await openProjectPcm(client, audio, signal); const worker = projectPcmWorker();
  try {
    const peaks = await buildPcmWaveform(wav, Math.min(256, wav.info.frameCount), { signal, worker, onProgress });
    return { info: wav.info, peaks: [...peaks.min].map((low, index) => Math.max(Math.abs(low), Math.abs(peaks.max[index]!))) };
  } finally { worker.close(); await wav.dispose(); }
}

export interface ProjectMixTrack {
  readonly audio: ProjectAudio;
  /** Zero-based placement on the chosen project timeline. */
  readonly startFrame: number;
  readonly sourceStartFrame: number;
  readonly sourceEndFrame: number;
  readonly gain: number;
}

// @nimi-authority: rule.overtone.data-model.r004
export async function renderProjectMix(input: {
  readonly client: MediaClient; readonly tracks: readonly ProjectMixTrack[];
  readonly output: PcmAudioInfo; readonly relativePath: string; readonly signal: AbortSignal;
  readonly onProgress?: (completedFrames: number, totalFrames: number) => void;
}): Promise<{ audio: ProjectAudio; peak: number; overRangeSamples: number }> {
  const { client, output, signal } = input;
  if (!input.tracks.length || input.tracks.length > 8) throw new Error('OVERTONE_MIX_TRACK_LIMIT');
  const tracks: { source: ProjectPcm; placement: ProjectMixTrack }[] = [];
  try {
  for (const placement of input.tracks) {
    if (![placement.startFrame, placement.sourceStartFrame, placement.sourceEndFrame].every(n => Number.isSafeInteger(n) && n >= 0)
      || placement.sourceEndFrame <= placement.sourceStartFrame || placement.sourceEndFrame > placement.audio.frameCount
      || !Number.isFinite(placement.gain) || Math.abs(placement.gain) > 16) throw new Error('OVERTONE_MIX_RANGE_INVALID');
    const source = await openProjectPcm(client, placement.audio, signal);
    tracks.push({ source, placement });
    if (source.info.sampleRateHz !== output.sampleRateHz || source.info.channels !== output.channels) throw new Error('OVERTONE_MIX_DOMAIN_MISMATCH');
  }
  } catch (error) { await Promise.all(tracks.map(track => track.source.dispose())); throw error; }
  const worker = projectPcmWorker(); let peak = 0; let overRangeSamples = 0;
  async function* blocks() {
    for (let start = 0; start < output.frameCount; start += PCM_BLOCK_FRAMES) {
      signal.throwIfAborted();
      const count = Math.min(PCM_BLOCK_FRAMES, output.frameCount - start);
      const parts = [];
      for (const { source, placement } of tracks) {
        const samples = new Float32Array(count * output.channels);
        const from = Math.max(start, placement.startFrame);
        const until = Math.min(start + count, placement.startFrame + placement.sourceEndFrame - placement.sourceStartFrame);
        if (until > from) samples.set(await readPcmFrames(source, placement.sourceStartFrame + from - placement.startFrame, until - from, signal), (from - start) * output.channels);
        parts.push({ ...output, samples, gain: placement.gain });
      }
      const result = await worker.mix({ ...output, frameCount: count, tracks: parts }, signal);
      peak = Math.max(peak, result.peak); overRangeSamples += result.overRangeSamples;
      yield result.samples;
      input.onProgress?.(start + count, output.frameCount);
    }
  }
  let committed: string | undefined;
  try {
    const asset = await client.storage.assets.write({ relativePath: input.relativePath, mediaType: 'audio/wav', overwrite: false,
      body: encodePcmWav(output, blocks(), signal) });
    committed = asset.relativePath;
    signal.throwIfAborted();
    const audio: ProjectAudio = { ...owned(asset), ...output, durationMs: Math.floor(output.frameCount * 1000 / output.sampleRateHz) };
    const verified = await openProjectPcm(client, audio, signal); await verified.dispose();
    return { audio, peak, overRangeSamples };
  } catch (error) {
    if (committed) {
      try { await client.storage.assets.remove(committed); }
      catch (cleanup) { throw new Error(`${String(error)}; incomplete local render cleanup: ${String(cleanup)}`); }
    }
    throw error;
  } finally { worker.close(); await Promise.all(tracks.map(track => track.source.dispose())); }
}

function owned(asset: Awaited<ReturnType<NimiLocalAppClient['storage']['assets']['write']>>): OwnedAsset {
  if (asset.mediaType !== 'audio/wav') throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  return { relativePath: asset.relativePath, mimeType: asset.mediaType, sha256: asset.sha256, sizeBytes: asset.sizeBytes };
}
