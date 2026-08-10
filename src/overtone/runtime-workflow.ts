import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';

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
