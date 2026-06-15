import { Suspense, lazy } from 'react';

const WorkspacePage = lazy(async () => {
  const mod = await import('../../overtone/workspace-page.js');
  return { default: mod.WorkspacePage };
});

export function ProductArea() {
  return (
    <Suspense fallback={null}>
      <WorkspacePage />
    </Suspense>
  );
}
