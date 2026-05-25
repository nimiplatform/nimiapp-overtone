# Overtone Product Contract

Rule family: `OVT-PROD-*`. Invariants that any Overtone product or
implementation change must respect.

## OVT-PROD-01 — Single authority surface

`.nimi/spec/overtone/**` is the only normative authority for the
Overtone product. Any rule, table, or invariant referenced from source
must trace back to a file in this directory. Source modules under
`src/overtone/**` and contract tests under `test/**` must match the
authority surface or fail validation.

## OVT-PROD-02 — Nimi App posture

Overtone is admitted as a standalone Nimi App (profile `standalone`,
`app_id: nimi.overtone`). It is not a desktop platform shell, not a mod,
and not an embeddable surface inside another Nimi App. Source must not
register Overtone as a desktop sub-shell, mod manifest, or
multi-app-container surface.

## OVT-PROD-03 — No Overtone-specific backend

Overtone must not introduce a parallel HTTP service, broker, websocket
gateway, persistence service, or job orchestrator. All AI work flows
through `@nimiplatform/sdk/runtime`; all social publishing flows through
`@nimiplatform/sdk/realm`. Local-only persistence is permitted inside
the renderer (memory + browser storage admitted by
`OVT-DATA-08`) or inside the scaffold-managed Tauri shell.

## OVT-PROD-04 — Single workspace per instance

The app surface has exactly one active `SongProject` workspace per app
instance. Multi-project navigation, sidebar project switcher, and
parallel session windows are out of P0 scope. A renderer must not
display a project list, project picker, or workspace tab control.

## OVT-PROD-05 — Take-system iteration

Music generation results are takes, not a single output slot. Every
completed `MUSIC_GENERATE` job that yields at least one artifact must
produce a `SongTake` entry; selection happens by `selectedTakeId`. A
generation that replaces or overwrites a previous result is forbidden.

## OVT-PROD-06 — Fail-close on typed contract violations

Missing typed runtime output, missing artifact MIME type, missing
scenario discriminator, or schema mismatch on a runtime / realm response
must surface a typed empty / error state to the user. The renderer must
not synthesize placeholder audio, fabricate a `takeId`, or coerce a
failed job into a `completed` state.

## OVT-PROD-07 — No pseudo-success on stable product paths

Brief generation, lyrics generation, music generation, take selection,
and realm publish are stable product paths (`OVT-FLOW-*`). The renderer
must not present a "completed" state when the underlying runtime / realm
call returned an error, was canceled, was retried internally without
reaching success, or returned a typed `unavailable` projection.

## OVT-PROD-08 — No hardcoded provider / model lists

Source must not embed connector ids, provider ids, or model ids as
constants in the product code. The connector / model surface is
discovered at runtime through `runtime.connector.*` and
`runtime.ai.listScenarioProfiles(...)`. A renderer that hardcodes a
provider id, model id, or connector vendor name in product UI strings is
a contract violation.

## OVT-PROD-09 — No fallback hiding contract failures

Retry and auth refresh are transport / auth mechanisms only. They must
never rescue decode, content-type, schema, or contract failures. A
failed `MUSIC_GENERATE` job must not silently retry on a different
connector; the user must see the failure and pick the recovery action.

## OVT-PROD-10 — App-facing SDK only

The renderer and the scaffold-managed shell must consume only
`@nimiplatform/sdk/*` and `@nimiplatform/kit/*` for SDK / kit surfaces.
Imports from `runtime/internal/**` or any private upstream package path
are forbidden. The scaffold-boundary test enforces this for the shell;
`src/overtone/**` is bound by the same rule.
