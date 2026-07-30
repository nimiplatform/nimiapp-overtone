# Overtone Removed Surfaces Contract

Rule family: `OVT-REMOVED-*`. Hard removals — surfaces, terms, and
patterns whose reappearance in active product code MUST fail closed.

## OVT-REMOVED-01 — No Overtone-specific backend

Removed: any Overtone-specific HTTP service, websocket gateway, broker,
persistence service, ORM, queue worker, or job orchestrator. All AI
work flows through `@nimiplatform/sdk/runtime`; all social publishing
flows through `@nimiplatform/sdk/realm`.

## OVT-REMOVED-02 — No app-owned token custody

Removed: app-owned access-token, refresh-token, subject-user-id,
session-store, oauth-code, or refresh-cookie custody in renderer or
Tauri shell. See `OVT-AUTH-03`.

## OVT-REMOVED-03 — No hardcoded provider catalog

Removed: hardcoded provider id, model id, connector vendor name, or
provider-specific tier label as app constants or display strings. See
`OVT-PROD-08`.

## OVT-REMOVED-04 — No generic chat surface

Removed: any generic chat / conversation / agent shell as part of the
Overtone primary surface. Overtone is a music-creation workspace, not a
chat product. (Future Overtone-side conversation surfaces, if admitted,
would belong in a separate contract; the current spec excludes them.)

## OVT-REMOVED-05 — No tester / world-tour surfaces

Removed: `TesterWorkbench`, `kit-component-gallery`, `world-tour`
viewer route, `world_tour_*` Tauri commands, scaffold tester contract
tests, `tester-*` renderer modules. The Overtone shell inherits the
scaffold-managed glue surface but MUST NOT carry forward the tester
app-owned product code.

## OVT-REMOVED-06 — No dataset / orchestration consoles

Removed: dataset console, batch-import surface, batch-export surface,
workflow orchestration shell, model-evaluation grid, agent-supervisor
panel, mod-runtime console.

## OVT-REMOVED-07 — No mod consumption

Removed: any Overtone import of mod-runtime, mod-host, `nimi-hook`,
runtime mod manifests, or a mod registry. Overtone is a Nimi App, not a
mod host.

## OVT-REMOVED-08 — No multi-project workspace navigation

Removed: project list, project picker, multi-project sidebar, parallel
session windows. The product has one active `SongProject` per app
instance (`OVT-PROD-04`).

## OVT-REMOVED-09 — No raw provider JSON in UI

Removed: surfaces that render provider-specific raw JSON, raw vendor
error envelopes, or provider terminology directly in user-facing text.
The app-owned extension builder is the only translation layer.

## OVT-REMOVED-10 — No agent / autonomous loop surfaces

Removed: agent runner, autonomous-loop scheduler, background agent
spawn, multi-agent supervisor surface. Overtone runs only in response
to explicit user action.

## OVT-REMOVED-11 — Removed surface name catalog

Names registered in
[`tables/removed-surface-names.yaml`](tables/removed-surface-names.yaml)
MUST never reappear in active source as exported symbols, route
identifiers, or test ids. The removed-surface validator (when added) is
the mechanical guard.
