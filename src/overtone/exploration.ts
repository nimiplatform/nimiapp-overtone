import { normalizeGeneratedLyrics } from './lyrics.js';
import type { SongBrief } from './types.js';

export interface MusicDirection {
  brief: SongBrief;
  twist: string;
  lyrics: string;
}

// @nimi-authority: rule.overtone.exploration.r001
export const DIRECTION_SYSTEM = `You are Overtone, an adventurous music collaborator.
Turn the user's scene into THREE genuinely different musical possibilities, not synonyms of one genre.
Keep one recognizable emotional thread. Direction 1 is intimate and grounded, 2 crosses genres,
3 is an unexpected but coherent experiment. Translate images into specific instruments, rhythm,
vocal character and arrangement. No artist imitation, model names, production claims or audio analysis.
Respect the user's energy (0=still, 100=explosive) and surprise (0=familiar, 100=unconventional).
When source lyrics are provided, retain their central image; do not claim to preserve an audio melody.
Write titles, descriptions, twists and singable lyrics in the requested language.
Return ONLY JSON: {"directions":[{"title":"...","genre":"...","mood":"...","tempo":"...",
"description":"...","twist":"...","lyrics":"..."}, ...]}.
Exactly 3 directions. Title <= 60 characters, genre/mood/tempo <= 100 each,
description <= 700 characters, twist <= 160 characters, lyrics 4-12 short lines, <= 900 characters.
Lyrics are actual singable words. Use [verse] and [chorus] tags on their own lines, followed by lyrics on new lines.
Do not use instructions or placeholders.`;

export function parseMusicDirections(text: string): MusicDirection[] {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(clean);
  if (!parsed || typeof parsed !== 'object' || !('directions' in parsed)
    || !Array.isArray(parsed.directions) || parsed.directions.length !== 3) {
    throw new Error('OVERTONE_DIRECTIONS_INVALID');
  }
  const read = (object: Record<string, unknown>, field: string, max: number) => {
    const value = object[field];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max || value.includes('\0')) {
      throw new Error('OVERTONE_DIRECTIONS_INVALID');
    }
    return value.trim();
  };
  const directions = parsed.directions.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('OVERTONE_DIRECTIONS_INVALID');
    const value = item as Record<string, unknown>;
    return {
      brief: {
        title: read(value, 'title', 80), genre: read(value, 'genre', 160),
        mood: read(value, 'mood', 160), tempo: read(value, 'tempo', 160),
        description: read(value, 'description', 1500),
      },
      twist: read(value, 'twist', 240), lyrics: normalizeGeneratedLyrics(read(value, 'lyrics', 1500)),
    };
  });
  if (new Set(directions.map((entry) => entry.brief.title.toLowerCase())).size !== 3) {
    throw new Error('OVERTONE_DIRECTIONS_INVALID');
  }
  return directions;
}

export function buildMusicPrompt(brief: SongBrief, styleTags: string, energy: number, surprise: number): string {
  return [brief.description.trim(), [brief.genre, brief.mood, brief.tempo, styleTags].map((v) => v.trim()).filter(Boolean).join(', '),
    `Energy: ${energy < 34 ? 'gentle and spacious' : energy > 66 ? 'driving and energetic' : 'flowing and expressive'}.`,
    `Arrangement: ${surprise < 34 ? 'familiar, clear and melodic' : surprise > 66 ? 'unexpected instrumentation and adventurous transitions, musically coherent' : 'a distinctive blend of familiar and unexpected textures'}.`,
  ].filter(Boolean).join('\n').trim();
}

export function musicInputValid(prompt: string, lyrics: string): boolean {
  const bytes = new TextEncoder();
  return !!prompt.trim() && !!lyrics.trim() && !prompt.includes('\0') && !lyrics.includes('\0')
    && bytes.encode(prompt).byteLength <= 32 * 1024 && bytes.encode(lyrics).byteLength <= 32 * 1024;
}

export function formatAudioTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
}
