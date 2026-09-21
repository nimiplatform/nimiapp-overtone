import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource as load } from './load-source.mjs';
const {parseMusicDirections,buildMusicPrompt,musicInputValid}=await load('../src/overtone/exploration.ts');
const {normalizeGeneratedLyrics}=await load('../src/overtone/lyrics.ts');
const {parseFullSong,fullSongDraftValid,fullSongInput,songFallsShort}=await load('../src/overtone/full-song.ts');
const direction=(title)=>({title,genre:'Jazz',mood:'Curious',tempo:'80 BPM',description:'Warm bass and brushed percussion.',twist:'Music-box counterpoint.',lyrics:'[Verse]\nWe drift through the night\n[Chorus]\nEarth is a distant light'});
test('directions require three distinct, complete, bounded AI proposals',()=>{
  const complete={directions:[direction('Moon'),direction('Orbit'),direction('Earth')]};
  assert.equal(parseMusicDirections(JSON.stringify(complete)).length,3);
  assert.throws(()=>parseMusicDirections(JSON.stringify({directions:[direction('Moon')]})));
  assert.throws(()=>parseMusicDirections(JSON.stringify({directions:[direction('Moon'),direction('Moon'),direction('Earth')]})));
  assert.throws(()=>parseMusicDirections(JSON.stringify({directions:[{...direction('Moon'),lyrics:''},direction('Orbit'),direction('Earth')]})));
  assert.throws(()=>parseMusicDirections(JSON.stringify({directions:[{...direction('Moon'),description:'x'.repeat(1501)},direction('Orbit'),direction('Earth')]})));
  assert.throws(()=>parseMusicDirections('not JSON'));
});
test('sound intent reaches the actual prompt and invalid music input is withheld',()=>{
  const brief=direction('Moon');
  const calm=buildMusicPrompt(brief,'acoustic',10,10);
  const wild=buildMusicPrompt(brief,'acoustic',90,90);
  assert.match(calm,/gentle and spacious/);
  assert.match(wild,/unexpected instrumentation/);
  assert.match(wild,/Warm bass/);
  assert.equal(musicInputValid(wild,brief.lyrics),true);
  assert.equal(musicInputValid(wild,''),false);
  assert.equal(musicInputValid(wild,'\0'),false);
  assert.equal(musicInputValid(wild,'声'.repeat(11000)),false);
});
test('AI lyric headings use standalone tags without changing sung words',()=>{
  assert.equal(normalizeGeneratedLyrics('[Verse] 月球酒吧，灯光微弱\n[Chorus]\n我思念你'), '[verse]\n月球酒吧，灯光微弱\n[chorus]\n我思念你');
  assert.equal(normalizeGeneratedLyrics('A lyric [about tomorrow]'), 'A lyric [about tomorrow]');
  const result = parseMusicDirections(JSON.stringify({directions:[direction('Moon'),direction('Orbit'),direction('Earth')]}));
  assert.equal(result[0].lyrics, '[verse]\nWe drift through the night\n[chorus]\nEarth is a distant light');
});

test('full song requires a complete bounded lyrical arrangement',()=>{
 const sections=Array.from({length:6},(_,i)=>({kind:i%2?'chorus':'verse',name:'Verse '+i,arrangement:'Piano enters',lyrics:'One\nTwo\nThree\nFour'}));
 const result=parseFullSong(JSON.stringify({title:'A whole song',sections}));
 assert.equal(result.sections.length,6);
 assert.throws(()=>parseFullSong(JSON.stringify({title:'Only a sketch',sections:sections.slice(0,2)})));
 assert.throws(()=>parseFullSong(JSON.stringify({title:'No lyrics',sections:sections.map(s=>({...s,lyrics:''}))})));
 assert.throws(()=>parseFullSong('null'));
});
test('edited full songs retain completeness and duration checks without rewriting author lyrics',()=>{
 const sections=Array.from({length:6},(_,i)=>({kind:i%2?'chorus':'verse',name:'Section '+i,arrangement:'Piano enters',lyrics:'  One\nTwo\nThree\nFour  '}));
 const draft={sourcePrompt:'A gentle melody',sourceLyrics:'Hook',title:'A whole song',durationSeconds:120,sections};
 assert.equal(fullSongDraftValid(draft),true);
 assert.equal(fullSongDraftValid({...draft,durationSeconds:45}),false);
 assert.equal(fullSongDraftValid({...draft,sections:sections.map(s=>({...s,lyrics:''}))}),false);
 assert.equal(fullSongDraftValid({...draft,sections:sections.map((s,i)=>i===0?{...s,arrangement:' '}:s)}),false);
 assert.equal(fullSongDraftValid({...draft,sections:[...sections,...sections]}),false);
 assert.equal(fullSongInput(draft).lyrics.startsWith('[verse]\n  One\nTwo\nThree\nFour  '),true);
});
test('full-song render preserves source and every edited section, with a real duration intent',()=>{
 const draft={sourcePrompt:'8-bit love song',sourceLyrics:'Hook',title:'Arcade',durationSeconds:120,sections:[{kind:'verse',name:'Verse',arrangement:'Dry drums',lyrics:'My edited line'},{kind:'outro',name:'Ending',arrangement:'Let the piano resolve',lyrics:'Home at last'}]};
 const input=fullSongInput(draft);
 assert.match(input.prompt,/8-bit love song/);
 assert.match(input.prompt,/120 seconds/);
 assert.match(input.prompt,/Let the piano resolve/);
 assert.equal(input.lyrics,'[verse]\nMy edited line\n\n[outro]\nHome at last');
 assert.equal(songFallsShort(20,120),true);
 assert.equal(songFallsShort(120.01,120),false);
});
