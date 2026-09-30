export function scrollIntoView(element: Element | null | undefined, options: ScrollIntoViewOptions = {}): void {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView({ ...options, behavior: reduced ? 'instant' : options.behavior ?? 'auto' });
}
