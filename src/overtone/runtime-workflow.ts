import { createNimiLocalAppRuntimeScenarioJobClient, type NimiLocalAppClient } from '@nimiplatform/sdk/app';
import type { ScenarioJob } from '@nimiplatform/sdk/runtime/generated';
import { runRuntimeMusicGenerate } from '@nimiplatform/kit/features/generation/runtime';

export interface RuntimeTextGenerationInput {
  readonly client: Pick<NimiLocalAppClient, 'ai'>;
  readonly input: string;
  readonly system: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export async function generateRuntimeText(input: RuntimeTextGenerationInput): Promise<string> {
  const result = await input.client.ai.text.generateCandidate({
    messages: [
      { role: 'system', text: input.system },
      { role: 'user', text: input.input },
    ],
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  });
  const text = result.text.trim();
  if (!text) throw new Error('Runtime returned an empty text candidate.');
  return text;
}

// @nimi-authority: rule.overtone.runtime.r003
// @nimi-authority: rule.overtone.runtime.r004
export async function generateRuntimeMusic(input: {
  readonly client: Pick<NimiLocalAppClient, 'ai'>;
  readonly prompt: string;
  readonly lyrics: string;
  readonly signal: AbortSignal;
  readonly onJobUpdate: (job: ScenarioJob) => void;
}) {
  const result = await runRuntimeMusicGenerate({
    runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(input.client.ai) },
    appId: 'nimi.overtone',
    prompt: input.prompt,
    lyrics: input.lyrics,
    scenarioId: 'overtone.music.generate',
    surfaceId: 'nimi.overtone.generate',
    signal: input.signal,
    onJobUpdate: input.onJobUpdate,
  });
  if (!result.ok) throw result.error;
  input.signal.throwIfAborted();
  const artifact = result.output.firstArtifact;
  const audio = await readRuntimeMusicArtifact({ client: input.client, artifact, signal: input.signal });
  const decoded = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(audio.buffer.slice(0));
  input.signal.throwIfAborted();
  return { jobId: result.output.jobId, ...audio, durationSeconds: decoded.duration };
}

// @nimi-authority: rule.overtone.data-model.r005
export async function readRuntimeMusicArtifact(input: {
  readonly client: Pick<NimiLocalAppClient, 'ai'>;
  readonly artifact: { readonly artifactId: string; readonly mimeType?: string; readonly sizeBytes?: number };
  readonly signal: AbortSignal;
}) {
  input.signal.throwIfAborted();
  const artifact = input.artifact;
  const read = await input.client.ai.artifacts.read(artifact.artifactId);
  input.signal.throwIfAborted();
  const mimeType = read.mimeType.toLowerCase().split(';')[0]!.trim();
  const extensions: Record<string, string> = {
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
    'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a',
    'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/webm': 'webm', 'audio/aac': 'aac',
  };
  const extension = extensions[mimeType];
  if (!extension || !read.bytes.byteLength || read.sizeBytes !== read.bytes.byteLength
    || artifact.sizeBytes !== read.bytes.byteLength || read.mimeType !== artifact.mimeType) {
    throw new Error('Runtime music artifact metadata does not match its audio bytes.');
  }
  const buffer = Uint8Array.from(read.bytes).buffer;
  return {
    artifactId: artifact.artifactId, mimeType: read.mimeType, buffer, extension,
  };
}
