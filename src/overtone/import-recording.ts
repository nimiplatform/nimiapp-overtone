import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { MusicAudioCache } from './media-cache.js';
import { loadProjectAudio } from './runtime-workflow.js';
import { makeId, type OwnedAsset, type ProjectAudio, type SongTake } from './types.js';

export type RecordingImportStage = 'copying' | 'preparing' | 'checking';

// @nimi-authority: rule.overtone.workflow.r013-import-recording
export async function importRecording(input: {
  readonly client: NimiLocalAppClient; readonly cache: MusicAudioCache; readonly file: File;
  readonly signal: AbortSignal; readonly onStage?: (stage: RecordingImportStage) => void;
}): Promise<SongTake> {
  const { client, cache, file, signal } = input;
  signal.throwIfAborted();
  const extension = file.name.match(/\.(wav|mp3|flac)$/iu)?.[1]?.toLowerCase();
  if (!extension || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 512 * 1024 * 1024) throw new Error('OVERTONE_RECORDING_FORMAT_OR_SIZE');
  const mimeType = extension === 'mp3' ? 'audio/mpeg' : extension === 'flac' ? 'audio/flac' : 'audio/wav';
  const takeId = makeId('take'); const prefix = `music/imports/${takeId}`;
  const created: string[] = [];
  async function* fileChunks(): AsyncGenerator<Uint8Array> {
    const reader = file.stream().getReader(); const abort = () => { void reader.cancel().catch(() => undefined); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        signal.throwIfAborted(); const next = await reader.read(); signal.throwIfAborted();
        if (next.done) break;
        yield next.value;
      }
    } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  try {
    input.onStage?.('copying');
    const original = await client.storage.assets.write({ relativePath: `${prefix}/source.${extension}`, mediaType: mimeType, body: fileChunks(), overwrite: false });
    created.push(original.relativePath);
    if (original.sizeBytes !== file.size || original.mediaType !== mimeType) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    signal.throwIfAborted(); input.onStage?.('preparing');
    // The current protected upload is a bounded unary operation. Cancellation
    // abandons adoption after it settles; it cannot claim to interrupt the codec.
    const prepared = await client.ai.artifacts.upload({ source: { kind: 'app-asset', relativePath: original.relativePath },
      mimeType, audioPreparation: { profile: 'canonical-pcm-v1' } });
    signal.throwIfAborted();
    if (!prepared.audioInfo || prepared.mimeType !== 'audio/wav') throw new Error('OVERTONE_CANONICAL_AUDIO_MISSING');
    const adopted = await client.storage.assets.adoptArtifact({ artifactId: prepared.artifactId, relativePath: `${prefix}/canonical.wav`, overwrite: false });
    created.push(adopted.relativePath);
    if (adopted.mediaType !== prepared.mimeType || adopted.sizeBytes !== prepared.sizeBytes) throw new Error('OVERTONE_ARTIFACT_METADATA_CHANGED');
    const asset = (value: typeof original): OwnedAsset => ({ relativePath: value.relativePath, mimeType: value.mediaType!, sizeBytes: value.sizeBytes, sha256: value.sha256 });
    const audio: ProjectAudio = { ...asset(adopted), ...prepared.audioInfo };
    signal.throwIfAborted(); input.onStage?.('checking');
    await loadProjectAudio({ client, cache, audio, signal }); signal.throwIfAborted();
    return { takeId, title: file.name.replace(/\.[^.]+$/u, '').slice(0, 80), origin: 'imported-recording', originalAsset: asset(original), audio,
      promptSnapshot: '', durationSeconds: audio.frameCount / audio.sampleRateHz, favorite: false, discarded: false, createdAt: Date.now() };
  } catch (error) {
    const failures: string[] = [];
    for (const path of created.reverse()) { cache.remove(path); try { await client.storage.assets.remove(path); } catch (cleanup) { failures.push(String(cleanup)); } }
    if (failures.length) throw new Error(`${String(error)}; import cleanup: ${failures.join('; ')}`);
    throw error;
  }
}
