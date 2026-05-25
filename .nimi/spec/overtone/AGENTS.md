# Overtone Spec — AGENTS.md

> Authoring rules for AI agents editing Overtone product authority spec.

## Authority

- `.nimi/spec/overtone/**` is the only active normative source of
  Overtone product authority. It owns the product positioning, data
  model, workflow, runtime/realm integration boundary, IA, kit
  consumption rules, and removed-surface contract.
- `.nimi/{methodology,contracts,config}/**` is the nimicoding governance
  projection — owned by `@nimiplatform/nimi-coding`, managed via
  `pnpm exec nimicoding sync`. NOT Overtone product authority and never
  hand-edited.
- `.nimi/local/**` and `.nimi/cache/**` are local-only operational
  artifacts.
- `.nimi/app-scaffold/**` (`intent.json`, `lock.json`) is `nimi-app`
  tooling state, not product authority.
- `ADMISSION.md` and `.nimi/admission/**` are developer-submitted review
  inputs, not platform admission truth.

## Structure

```
.nimi/spec/
├── INDEX.md                                       # cross-domain reading path
└── overtone/
    ├── AGENTS.md                                  # this file
    ├── index.md                                   # domain reading guide
    ├── overtone.md                                # product overview + root model
    └── kernel/
        ├── index.md                               # kernel authority map
        ├── product-contract.md                    # OVT-PROD-*
        ├── data-model-contract.md                 # OVT-DATA-*
        ├── workflow-contract.md                   # OVT-FLOW-*
        ├── runtime-integration-contract.md        # OVT-RT-*
        ├── realm-integration-contract.md          # OVT-REALM-*
        ├── auth-contract.md                       # OVT-AUTH-*
        ├── ia-contract.md                         # OVT-IA-*
        ├── kit-ui-consumption-contract.md         # OVT-KIT-*
        ├── removed-surfaces-contract.md           # OVT-REMOVED-*
        └── tables/
            ├── feature-tier-matrix.yaml
            ├── runtime-scenario-bindings.yaml
            ├── runtime-account-caller.yaml
            ├── error-reason-handling.yaml
            ├── take-origin-catalog.yaml
            ├── nimi-kit-allowlists.yaml
            └── removed-surface-names.yaml
```

## Rule ID Format

`OVT-<DOMAIN>-<NN>` where DOMAIN is `PROD`, `DATA`, `FLOW`, `RT`,
`REALM`, `AUTH`, `IA`, `KIT`, or `REMOVED`. NN is zero-padded sequential
per file. Rule IDs are unique across the whole `.nimi/spec/overtone/**`
tree.

## Hard Editing Rules

1. Do not introduce an Overtone-specific backend (HTTP service, broker,
   websocket gateway, persistence service). All AI flows go through
   `@nimiplatform/sdk/runtime`; all social publishing flows go through
   `@nimiplatform/sdk/realm`. Local persistence stays inside the renderer
   or the scaffold-managed Tauri shell only.
2. Do not move Overtone authority out of `.nimi/spec/overtone/**`.
3. Do not introduce app-owned access-token, refresh-token,
   subject-user-id, or session-store custody in the renderer or bridge.
   Token custody belongs to runtime; the Overtone shell only consumes
   `@nimiplatform/sdk` helpers that already fail-close on token inputs.
4. `SongTake.origin` is restricted to the enum admitted in
   `tables/take-origin-catalog.yaml`. Do not invent new origin values
   inline in source.
5. Do not hardcode provider, model, or connector identifiers in product
   code or in spec contracts. Runtime is the source of truth for
   connectors and models; Overtone reads its selection through the
   readiness flow.
6. Reference-audio, extend, remix, and style-reference semantics MUST
   stay behind `runtime.media.music.generate({ extensions: ... })`
   namespaced as `nimi.scenario.music_generate.request`. Do not promote
   them into top-level public fields before runtime exposes them.
7. Do not expose raw provider JSON in user-facing surfaces; keep an
   app-owned extension builder so the UI contract stays stable.
8. Do not bypass the `OVT-KIT-*` allowlist by introducing parallel
   in-app shells that duplicate kit-provided components (auth page,
   generation panel, status badges, surfaces).
9. The renderer must not import from `runtime/internal/**` of any
   upstream package; only `@nimiplatform/sdk/*` and `@nimiplatform/kit/*`
   are admitted SDK / kit surfaces.
10. Removed surfaces and forbidden names listed in
    `removed-surfaces-contract.md` and
    `tables/removed-surface-names.yaml` must never reappear as active
    product surfaces; their presence in source is a contract violation.

## Source / Spec Coherence

For every concrete contract change in `.nimi/spec/overtone/**`, the
matching `src/overtone/**` source module and `test/**` contract tests
must remain in sync before the change can close.

A spec-only authority change may intentionally leave source
synchronization pending when the change explicitly forbids source
writes. In that case the change MUST record source synchronization as a
downstream implementation blocker, and no implementation-level closeout
may claim semantic closure until source and tests catch up.
