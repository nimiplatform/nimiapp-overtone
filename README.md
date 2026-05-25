# Nimi Overtone

AI-native music creation Nimi App. Tauri 2 + React 19 + `@nimiplatform/sdk` + `@nimiplatform/kit`.

Overtone walks an author from a short idea to a publishable song through the
**Brief → Lyrics → Generate → Compare Takes → Publish** loop, talking directly
to `nimi runtime` for AI work and `nimi realm` for publishing. There is no
Overtone-specific backend.

## Quick start

```bash
pnpm install
pnpm run init
pnpm dev:shell      # full Tauri shell + Vite renderer
pnpm dev:renderer   # renderer only (browser preview)
pnpm run check      # doctor + tests + validate
pnpm run pack       # produce dist/nimi-app-submission.json
```

## Authority surface

| Path | Role |
|---|---|
| `nimi.app.yaml` | App identity + declared Nimi API scopes |
| `.nimi/spec/**` | Active normative product authority |
| `.nimi/{config,contracts,methodology}/**` | nimicoding-managed projection (do not hand-edit) |
| `.nimi/app-scaffold/**` | Scaffold intent + lock for `nimi-app` tooling |
| `.nimi/admission/**` + `ADMISSION.md` | Developer-submitted listing inputs |
| `src/shell/**` | Scaffold-managed auth + Runtime + Tauri shell glue |
| `src/overtone/**` | App-owned product code (workspace, takes, publish) |

## Boundaries

- Renderer owns all product logic. Rust side stays transport / daemon only.
- All AI flows go through `@nimiplatform/sdk/runtime`; publish goes through `@nimiplatform/sdk/realm`.
- UI composed from `@nimiplatform/kit/ui`, `@nimiplatform/kit/auth`, and `@nimiplatform/kit/features/generation`.
- No fallback that hides typed contract failures; auth/runtime/realm errors surface as typed empty states.
