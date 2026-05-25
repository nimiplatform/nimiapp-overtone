import { Button } from '@nimiplatform/kit/ui';
import { useOvertoneActions, useOvertoneState } from '../store.js';

export function OvertoneEmptyState() {
  const { startProject } = useOvertoneActions();
  const { readiness } = useOvertoneState();

  const dots: Array<{ label: string; state: 'ready' | 'pending' | 'error' }> = [
    {
      label: 'Runtime',
      state:
        readiness.runtimeStatus === 'ready' || readiness.runtimeStatus === 'degraded'
          ? 'ready'
          : readiness.runtimeStatus === 'checking'
            ? 'pending'
            : 'error',
    },
    { label: 'Realm', state: readiness.realmConfigured ? 'ready' : 'pending' },
    { label: 'Music', state: readiness.musicConnectorAvailable ? 'ready' : 'pending' },
    { label: 'Text', state: readiness.textConnectorAvailable ? 'ready' : 'pending' },
  ];

  return (
    <div className="overtone-empty" data-testid="overtone-empty-state">
      <div>
        <h2>OVERTONE</h2>
        <p>AI music creation studio · Brief → Lyrics → Generate → Compare → Publish</p>
        <Button type="button" tone="primary" size="md" onClick={startProject}>
          Start New Session
        </Button>
        <div className="overtone-readiness">
          {dots.map((dot) => (
            <span key={dot.label}>
              <span className="overtone-readiness__dot" data-state={dot.state} />
              {dot.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
