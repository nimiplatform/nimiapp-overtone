import { ProductArea } from './routes/product-area.js';

// The protected carrier owns access; the product owns its visual canvas.
export function AuthenticatedShell() {
  return (
    <div
      className="app-shell"
      data-testid="nimi-app-shell"
    >
      <ProductArea />
    </div>
  );
}
