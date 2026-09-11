export const LYRIC_SECTION_KINDS = ['intro','verse','pre-chorus','chorus','bridge','outro'] as const;
export function serializeLyricSections(sections: readonly { kind: string; lyrics: string }[]) {
  return sections.map(section => [`[${section.kind}]`, section.lyrics].filter(Boolean).join('\n')).join('\n\n');
}
// AI proposals are normalized before the author sees them. Submission never rewrites manual words.
// Tags and sung words occupy separate lines; bracketed tags themselves are supported.
export function normalizeGeneratedLyrics(text: string): string {
  const names: Record<string,string> = { intro:'intro',verse:'verse',chorus:'chorus',bridge:'bridge',outro:'outro','pre-chorus':'pre-chorus','post-chorus':'chorus',前奏:'intro',主歌:'verse',副歌:'chorus',桥段:'bridge',尾声:'outro',预副歌:'pre-chorus' };
  return text.split(/\r?\n/).flatMap(line => {
    const tagged = line.match(/^\s*\[(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Post-Chorus|前奏|主歌|副歌|桥段|尾声|预副歌)(?:\s*\d+)?\]\s*(.*)$/i);
    const plain = line.match(/^\s*(Intro|Verse|Chorus|Bridge|Outro|Pre-Chorus|Post-Chorus|前奏|主歌|副歌|桥段|尾声|预副歌)(?:\s*\d+)?\s*[:：]?\s*$/i);
    const match = tagged ?? plain;
    return match ? [`[${names[match[1]!.toLowerCase()]}]`, ...(tagged?.[2] ? [tagged[2]] : [])] : [line];
  }).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
