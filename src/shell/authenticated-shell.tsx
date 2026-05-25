import { StatusBadge } from '@nimiplatform/kit/ui';
import { ProductArea } from './routes/product-area.js';
import { appTitle, scaffoldProfile } from './auth/runtime-platform.js';

export function AuthenticatedShell() {
  return (
    <main className="app-shell" data-testid="nimi-app-shell">
      <header className="app-chrome">
        <div>
          <p className="eyebrow">Nimi App</p>
          <strong>{appTitle}</strong>
        </div>
        <div className="chrome-badges">
          <StatusBadge tone="success" shape="dot">runtime-bound</StatusBadge>
          <StatusBadge tone="neutral">{scaffoldProfile}</StatusBadge>
        </div>
      </header>
      <div className="app-shell__body">
        <ProductArea />
      </div>
    </main>
  );
}
