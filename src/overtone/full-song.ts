import { serializeLyricSections } from './lyrics.js';
import type { FullSongDraft, SongSection, SongTake } from './types.js';

// @nimi-authority: rule.overtone.workflow.r012
export function belongsToSongDraft(take: SongTake, draft?: FullSongDraft | null): boolean {
  return !!draft && (take.takeId === draft.sourceTakeId || take.creationMode === 'song' && take.parentTakeId === draft.sourceTakeId);
}

// @nimi-authority: rule.overtone.workflow.r012
export const FULL_SONG_SYSTEM = `You are a songwriter completing a promising musical sketch.
Keep the source's genre, vocal character, central image and lyrical hook. Create a complete song,
with a developing second verse, recurring chorus, contrast and a deliberate ending.
Return ONLY JSON: {"title":"...","sections":[{"kind":"verse","name":"...","arrangement":"...","lyrics":"..."}]}.
Each kind must be intro, verse, pre-chorus, chorus, bridge or outro. Include at least two chorus sections.
Use 6-8 sections. Names and arrangement notes are in the user's language. Each arrangement is a
concrete, short musical direction (instruments, intensity, transition), not a claim about source audio.
Each vocal section has 4-6 short singable lines; repeat the chorus words in full every time.
An intro or outro may have empty lyrics. No placeholders, bracket tags, markdown or commentary.
Title <= 80 characters; section name <= 40; arrangement <= 200; lyrics <= 900 per section.
The requested duration is a writing target; you cannot guarantee timing or preserve an unheard melody.`;

export function parseFullSong(text: string): { title: string; sections: SongSection[] } {
  return parseSongArrangement(JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
}

// Validate the edited draft with the same completeness rules as an AI proposal,
// without applying the parser's normalization to the author's submitted words.
export function fullSongDraftValid(draft: FullSongDraft): boolean {
  try {
    parseSongArrangement(draft);
    return [90, 120, 180].includes(draft.durationSeconds);
  } catch { return false; }
}

function parseSongArrangement(input: unknown): { title: string; sections: SongSection[] } {
  const value = input as Record<string, unknown> | null;
  const read = (value: unknown, max: number, empty = false): string => {
    if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max || value.includes('\0')) throw new Error('OVERTONE_SONG_INVALID');
    return value.trim();
  };
  if (!value || !Array.isArray(value.sections) || value.sections.length < 6 || value.sections.length > 8) throw new Error('OVERTONE_SONG_INVALID');
  const sections = value.sections.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('OVERTONE_SONG_INVALID');
    const section = entry as Record<string, unknown>;
    if (!['intro','verse','pre-chorus','chorus','bridge','outro'].includes(String(section.kind))) throw new Error('OVERTONE_SONG_INVALID');
    return { kind: section.kind as SongSection['kind'], name: read(section.name, 40), arrangement: read(section.arrangement, 200), lyrics: read(section.lyrics, 900, true) };
  });
  if (sections.filter(section => section.lyrics.split('\n').filter(line => line.trim()).length >= 3).length < 4) throw new Error('OVERTONE_SONG_INVALID');
  if (sections.filter(section => section.kind === 'chorus').length < 2) throw new Error('OVERTONE_SONG_INVALID');
  return { title: read(value.title, 80), sections };
}

export function fullSongInput(draft: FullSongDraft) {
  return {
    prompt: [draft.sourcePrompt, `Complete song, up to ${draft.durationSeconds} seconds. Develop the theme and close with a deliberate ending.`,
      ...draft.sections.map((section, index) => `${index + 1}. ${section.name}: ${section.arrangement}`)].join('\n'),
    // Section tags occupy their own line, as required by the music engine's grammar.
    // The author-visible sung words are serialized exactly as edited.
    lyrics: serializeLyricSections(draft.sections),
  };
}

export function songFallsShort(actualSeconds: number, targetSeconds: number): boolean {
  return actualSeconds < targetSeconds * .75;
}
