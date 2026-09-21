import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import { buildPcmWaveform, createPcmWorkerClient, encodePcmWav, inspectCanonicalWav, PCM_BLOCK_FRAMES, readPcmFrames,
  type CanonicalWav, type PcmAudioInfo } from '@nimiplatform/kit/core/audio';
import type { OwnedAsset, ProjectAudio } from './types.js';
import { waitForAbort } from './media-cache.js';

type MediaClient = Pick<NimiLocalAppClient, 'storage'>;

// @nimi-authority: rule.overtone.data-model.r005
export async function openProjectPcm(client: MediaClient, audio: ProjectAudio, signal: AbortSignal): Promise<CanonicalWav> {
  const wav = await inspectCanonicalWav({ sizeBytes: audio.sizeBytes, read: async (offset, length, readSignal) => {
    const deadline = AbortSignal.any([...(readSignal ? [readSignal] : []), AbortSignal.timeout(30_000)]);
    const operation = async () => {
    deadline.throwIfAborted();
    const response = await client.storage.assets.read({ relativePath: audio.relativePath, offset, length });
    if (response.asset.sha256 !== audio.sha256 || response.asset.sizeBytes !== audio.sizeBytes || response.asset.mediaType !== audio.mimeType
      || response.range.offset !== offset || response.range.length !== length || response.range.totalSize !== audio.sizeBytes) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    const bytes = new Uint8Array(length); let received = 0;
    for await (const part of response.body) {
      deadline.throwIfAborted();
      if (received + part.byteLength > bytes.length) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
      bytes.set(part, received); received += part.byteLength;
    }
    deadline.throwIfAborted();
    if (received !== length) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    return bytes;
    };
    return waitForAbort(operation(), deadline);
  } }, signal);
  if (wav.info.sampleRateHz !== audio.sampleRateHz || wav.info.channels !== audio.channels || wav.info.frameCount !== audio.frameCount) throw new Error('OVERTONE_AUDIO_FACTS_CHANGED');
  return wav;
}

export function projectPcmWorker() {
  return createPcmWorkerClient(new Worker(new URL('./pcm-worker.ts', import.meta.url), { type: 'module' }));
}

export async function projectWaveform(client: MediaClient, audio: ProjectAudio, signal: AbortSignal,
  onProgress?: (completedFrames: number, totalFrames: number) => void) {
  const wav = await openProjectPcm(client, audio, signal); const worker = projectPcmWorker();
  try {
    const peaks = await buildPcmWaveform(wav, Math.min(256, wav.info.frameCount), { signal, worker, onProgress });
    return { wav, peaks: [...peaks.min].map((low, index) => Math.max(Math.abs(low), Math.abs(peaks.max[index]!))) };
  } finally { worker.close(); }
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
  const tracks: { source: CanonicalWav; placement: ProjectMixTrack }[] = [];
  for (const placement of input.tracks) {
    if (![placement.startFrame, placement.sourceStartFrame, placement.sourceEndFrame].every(n => Number.isSafeInteger(n) && n >= 0)
      || placement.sourceEndFrame <= placement.sourceStartFrame || placement.sourceEndFrame > placement.audio.frameCount
      || !Number.isFinite(placement.gain) || Math.abs(placement.gain) > 16) throw new Error('OVERTONE_MIX_RANGE_INVALID');
    const source = await openProjectPcm(client, placement.audio, signal);
    if (source.info.sampleRateHz !== output.sampleRateHz || source.info.channels !== output.channels) throw new Error('OVERTONE_MIX_DOMAIN_MISMATCH');
    tracks.push({ source, placement });
  }
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
    await openProjectPcm(client, audio, signal);
    return { audio, peak, overRangeSamples };
  } catch (error) {
    if (committed) {
      try { await client.storage.assets.remove(committed); }
      catch (cleanup) { throw new Error(`${String(error)}; incomplete local render cleanup: ${String(cleanup)}`); }
    }
    throw error;
  } finally { worker.close(); }
}

function owned(asset: Awaited<ReturnType<NimiLocalAppClient['storage']['assets']['write']>>): OwnedAsset {
  if (asset.mediaType !== 'audio/wav') throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
  return { relativePath: asset.relativePath, mimeType: asset.mediaType, sha256: asset.sha256, sizeBytes: asset.sizeBytes };
}
