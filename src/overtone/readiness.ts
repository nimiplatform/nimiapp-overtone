// Readiness is derived only from the protected Local App session and portable
// App AIConfig.

import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';
import type { ReadinessSnapshot } from './types.js';

export async function probeReadiness(client: NimiAppRuntimeClient, signal: AbortSignal): Promise<ReadinessSnapshot> {
  const base: ReadinessSnapshot = {
    runtimeStatus: 'checking',
    textCapabilityAvailable: false,
    musicCapabilityAvailable: false,
  };

  try {
    signal.throwIfAborted();
    const config = await client.aiConfig.get();
    signal.throwIfAborted();
    const text = config.effectiveSelections.find(item => item.capabilityContract === 'text.generate');
    const music = config.effectiveSelections.find(item => item.capabilityContract === 'music.generate');
    const transcription = config.effectiveSelections.find(item => item.capabilityContract === 'music.transcribe');
    const voiceConvert = config.effectiveSelections.find(item => item.capabilityContract === 'audio.voice.convert');
    const separation = config.effectiveSelections.find(item => item.capabilityContract === 'audio.separate');
    const transcriptionResource = transcription?.resource;
    const musicTranscriptionInput = transcriptionResource?.oneofKind === 'local' ? transcriptionResource.local.musicInput?.transcription
      : transcriptionResource?.oneofKind === 'cloud' ? transcriptionResource.cloud.target?.musicInput?.transcription : undefined;
    const voiceConvertResource = voiceConvert?.resource;
    const voiceConvertInput = voiceConvertResource?.oneofKind === 'local' ? voiceConvertResource.local.musicInput?.voiceConvert
      : voiceConvertResource?.oneofKind === 'cloud' ? voiceConvertResource.cloud.target?.musicInput?.voiceConvert : undefined;
    const resource = music?.resource;
    const musicInput = resource?.oneofKind === 'local' ? resource.local.musicInput : resource?.oneofKind === 'cloud' ? resource.cloud.target?.musicInput : undefined;
    return {
      ...base,
      runtimeStatus: 'ready',
      textCapabilityAvailable: text?.state === 'ready',
      musicCapabilityAvailable: music?.state === 'ready',
      musicTranscriptionAvailable: transcription?.state === 'ready',
      voiceConvertAvailable: voiceConvert?.state === 'ready',
      audioSeparateAvailable: separation?.state === 'ready',
      ...(musicTranscriptionInput ? { musicTranscriptionInput } : {}),
      ...(voiceConvertInput ? { voiceConvertInput } : {}),
      ...(musicInput ? { musicInput } : {}),
    };
  } catch (error) {
    return {
      ...base,
      runtimeStatus: 'unavailable',
      runtimeErrorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
