import { useEffect } from 'react';

// Keyboard affordances for the selected take's transport: Space toggles
// playback, Left/Right Arrow seek 5s, Shift+Arrow seek 15s. Keys aimed at
// interactive controls and overlays retain their native keyboard behavior.
// @nimi-authority: rule.overtone.ia.r010
export function usePlaybackShortcuts(input: {
  enabled: boolean;
  onTogglePlayback: () => void;
  onSeekDelta: (deltaSec: number) => void;
}): void {
  const { enabled, onTogglePlayback, onSeekDelta } = input;

  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest?.(
        'input, textarea, select, button, a[href], [role="button"], [role="slider"], [role="tab"], [role="menu"], [role="listbox"]',
      )) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;

      if (event.key === ' ') {
        event.preventDefault();
        if (event.repeat) return;
        onTogglePlayback();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const delta = event.shiftKey ? 15 : 5;
        const sign = event.key === 'ArrowLeft' ? -1 : 1;
        onSeekDelta(delta * sign);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onTogglePlayback, onSeekDelta]);
}
