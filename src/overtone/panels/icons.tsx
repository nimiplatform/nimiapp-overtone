export function OvertoneIcon({ name, size = 18 }: { name: 'spark' | 'shuffle' | 'arrow' | 'branch' | 'download' | 'music' | 'close' | 'loop' | 'settings' | 'plus' | 'notes' | 'heart' | 'play' | 'pause' | 'chevron' | 'volume'; size?: number }) {
  const paths = {
    spark: 'M12 3l2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z',
    shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m2-3c1.5-2 3-4 5-4h3m-4-4 4 4-4 4',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    branch: 'M6 3v12a3 3 0 0 0 3 3h10m-4-4 4 4-4 4M6 9h7a4 4 0 0 0 4-4V3',
    download: 'M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4',
    music: 'M9 18V5l11-2v13M9 8l11-2M9 18c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2ZM20 16c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Z',
    close: 'm6 6 12 12M6 18 18 6',
    loop: 'M4 8h13l-3-3m6 11H7l3 3M4 8v5m16 3v-5',
    settings: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
    plus: 'M12 4v16M4 12h16',
    notes: 'M5 3h14v18H5zM9 7h6M9 11h6M9 15h4',
    heart: 'M12 20 3.8 12a5 5 0 0 1 7.1-7.1L12 6l1.1-1.1a5 5 0 0 1 7.1 7.1L12 20Z',
    play: 'm8 5 11 7-11 7V5Z',
    pause: 'M8 5v14M16 5v14',
    chevron: 'm9 5 7 7-7 7',
    volume: 'M4 9h4l5-4v14l-5-4H4V9Zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
