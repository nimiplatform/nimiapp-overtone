# Overtone Kernel Authority Map

This directory is the normative authority landing for Overtone.

Normative surfaces:

- `product-contract.md` for product-level invariants (`OVT-PROD-*`):
  Nimi App posture, no Overtone backend, single workspace, take-system
  iteration discipline, fail-close on contract violations, no pseudo
  success.
- `data-model-contract.md` for `SongProject`, `SongBrief`,
  `LyricsDocument`, `SongTake`, `TakeArtifact`, `GenerationJob`,
  `PublishDraft`, `ReadinessSnapshot` (`OVT-DATA-*`).
- `workflow-contract.md` for the **Brief → Lyrics → Generate → Compare →
  Iterate → Publish** loop (`OVT-FLOW-*`).
- `runtime-integration-contract.md` for runtime SDK surfaces
  (`OVT-RT-*`): text streaming, music generation, async job lifecycle,
  scenario readiness, image and TTS optional surfaces, extension
  namespace for iteration semantics.
- `realm-integration-contract.md` for realm SDK surfaces
  (`OVT-REALM-*`): media upload, post creation, provenance metadata,
  publish failure handling.
- `auth-contract.md` for runtime account session
  (`OVT-AUTH-*`): caller identity, broker flow, token-custody
  prohibition, kit `<DesktopShellAuthPage>` consumption.
- `ia-contract.md` for information architecture (`OVT-IA-*`): single
  workspace, three-zone layout (Compose / Output / Transport),
  modal/dialog surfaces, no parallel navigation primitives.
- `kit-ui-consumption-contract.md` for kit allowlist
  (`OVT-KIT-*`): admitted modules, parallel-shell prohibition, theme
  pack, accent overrides.
- `removed-surfaces-contract.md` for hard removals (`OVT-REMOVED-*`):
  app-owned backend, app-owned token storage, hardcoded provider lists,
  global agent surfaces, mod consumption, generic chat panel, world-tour
  viewer, dataset orchestration.

Typed tables:

- `tables/feature-tier-matrix.yaml` registers each Overtone feature with
  its tier (P0 / P1 / P2) and required runtime surfaces.
- `tables/runtime-scenario-bindings.yaml` binds product feature ids to
  SDK runtime calls and scenario capability identifiers.
- `tables/runtime-account-caller.yaml` records the runtime account
  caller identity Overtone is admitted as.
- `tables/error-reason-handling.yaml` maps runtime / realm reason codes
  to admitted app-facing responses.
- `tables/take-origin-catalog.yaml` enumerates admitted `SongTake.origin`
  values.
- `tables/nimi-kit-allowlists.yaml` enumerates admitted kit module
  imports.
- `tables/removed-surface-names.yaml` registers names whose reappearance
  as active product surfaces must fail closed.

Guide-only documents:

- `../../INDEX.md` (`.nimi/spec/INDEX.md`) is the cross-domain reading
  path for humans.
- `../index.md` (`.nimi/spec/overtone/index.md`) is the Overtone domain
  guide.
- `../overtone.md` is the product overview, positioning, and root-model
  snapshot.

Authority rules:

- All `OVT-<DOMAIN>-NN` ids are unique across this kernel tree. Domain ∈
  {`PROD`, `DATA`, `FLOW`, `RT`, `REALM`, `AUTH`, `IA`, `KIT`,
  `REMOVED`}.
- Implementation code under `src/overtone/**` and contract tests under
  `test/**` must stay in sync with these kernel surfaces; a spec edit
  must update the matching tests in the same change, or open a dated
  drift note here.
- Iteration semantics for music (`extend`, `remix`, `style reference`,
  `reference audio`) live behind runtime extensions
  (`nimi.scenario.music_generate.request`); they are not stable
  top-level fields.
- Token custody, provider lists, and connector lifecycle belong to
  runtime; Overtone never mirrors them in app state.
