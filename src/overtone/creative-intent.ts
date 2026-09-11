export function createCreativeIntent() {
  let value = { energy: 55, surprise: 65 };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: Partial<typeof value>) {
      const energy = Math.round(Math.max(0, Math.min(100, next.energy ?? value.energy)));
      const surprise = Math.round(Math.max(0, Math.min(100, next.surprise ?? value.surprise)));
      if (energy === value.energy && surprise === value.surprise) return;
      value = { energy, surprise }; listeners.forEach(listener => listener());
    },
  };
}
