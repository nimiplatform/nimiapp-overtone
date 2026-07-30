# Overtone Kit UI Consumption Contract

Rule family: `OVT-KIT-*`. Admitted `@nimiplatform/kit/**` imports and
composition rules for Overtone.

## OVT-KIT-01 — Kit-first policy

For any UI primitive, surface, or pattern already covered by
`@nimiplatform/kit/**`, Overtone MUST consume the kit export rather
than build a parallel app-local equivalent. App-local CSS classes are
admitted only for cross-kit layout glue (workspace zoning, panel
spacing).

## OVT-KIT-02 — Admitted kit entry points

The admitted kit module imports for Overtone are enumerated in
[`tables/nimi-kit-allowlists.yaml`](tables/nimi-kit-allowlists.yaml).
Importing from any other kit submodule path is a contract violation.

## OVT-KIT-03 — Theme pack

The renderer MUST initialize `@nimiplatform/kit/ui#NimiThemeProvider`
with `accentPack="overtone-accent"` at the root. The light theme stylesheet
(`@nimiplatform/kit/ui/themes/light.css`) and the overtone accent stylesheet
(`@nimiplatform/kit/ui/themes/overtone-accent.css`) MUST both be imported
through `src/styles.css`. Switching the theme provider to `nimi-accent`,
`forge-accent`, or any other accent is a contract violation for the
default Overtone surface.

## OVT-KIT-04 — Auth UI

Login screens MUST use `@nimiplatform/kit/auth#DesktopShellAuthPage`
together with `@nimiplatform/kit/shell/renderer/bridge#createTauriOAuthBridge`.
Custom email / OTP / password / wallet auth surfaces are forbidden
(`OVT-AUTH-08`).

## OVT-KIT-05 — Generation panel

Music and (P1) image / TTS generation surfaces MUST consume
`@nimiplatform/kit/features/generation/runtime#useRuntimeGenerationPanel`
and `@nimiplatform/kit/features/generation/ui#RuntimeGenerationPanel`.
The renderer MAY supply app-owned controls slot content
(`controls={...}`), but must not reimplement the generation lifecycle,
job subscription, or scenario job projection logic that the kit feature
already exposes.

## OVT-KIT-06 — Surface and overlay primitives

The workspace MUST use the kit primitives:

- `Surface` for panel containers.
- `OverlayShell` for the publish modal.
- `StatusBadge` for chrome status, take origin, and readiness markers.
- `InlineAlert` for inline typed warnings.
- `Button`, `Toggle`, `SegmentedControl`, `ProgressIndicator`, and
  `TooltipProvider` for primitives.

A renderer that introduces a parallel button, badge, or surface
primitive duplicating these is a contract violation.

## OVT-KIT-07 — App-local glue is bounded

App-local CSS in `src/styles.css` is bounded to:

- Workspace layout (grid, gaps, max-widths).
- Take card layout that wraps a kit `Surface`.
- Transport bar layout.
- Empty-state typography that brands the empty Overtone surface.

App-local CSS MUST NOT redefine kit design tokens
(`--nimi-action-primary-bg`, surface tones, elevation shadows). Token
overrides live in the kit overtone accent stylesheet.

## OVT-KIT-08 — Kit version pinning

The renderer MUST consume the workspace-pinned `@nimiplatform/kit`
package version declared in `package.json`. Pulling kit components from
a vendored fork, a published patched fork, or an inline copy is a
contract violation. Drift from the pinned version requires updating
`package.json` and `pnpm-lock.yaml` in the same change.

## OVT-KIT-09 — No bypass through DOM tunneling

Wrapping kit components in `dangerouslySetInnerHTML`, portal-based
tunneling, or runtime-mutating wrapper components to bypass kit
behavior (a11y, focus management, theming) is a contract violation. The
intended extension surface is the documented `props`/`slot` API only.
