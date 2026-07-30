# Overtone Workflow Contract

Rule family: `OVT-FLOW-*`. Stages, transitions, and required user
states for the Overtone creation loop.

## OVT-FLOW-01 — Readiness gate

Before the workspace becomes interactive, the renderer MUST resolve a
fresh `ReadinessSnapshot` covering:

- runtime liveness via `runtime.ready({ timeoutMs })`
- scenario availability via `runtime.ai.listScenarioProfiles({})`
- text route availability via `listNimiRuntimeRouteOptionsWithHost(...)`
  for `text.generate`
- music route availability via `listNimiRuntimeRouteOptionsWithHost(...)`
  for `music.generate`
- realm configuration via the SDK realm helper

If runtime is `unavailable`, the workspace MUST render an unavailable
state with an explanatory message and a retry affordance. If runtime is
`ready` but no music connector / model pair is usable, the workspace
MUST still render but disable music-generation entry points and surface
a typed readiness warning.

## OVT-FLOW-02 — Stage order

The product loop runs in a fixed order:

1. `brief` — author writes an idea, the assistant optionally fills the
   structured brief.
2. `lyrics` — assistant generates or author writes lyrics.
3. `generate` — runtime `MUSIC_GENERATE` job produces a take.
4. `compare` — author selects, plays, A/B compares takes.
5. `iterate` — author runs an extend / remix / reference iteration
   producing a child take.
6. `publish` — author selects a master take and publishes to realm.

A renderer must not present steps 3+ as available before a `SongBrief`
exists (`description` non-empty). Extend / remix iteration requires an
existing non-discarded source take; reference iteration may start from an
uploaded `audio/*` reference without an existing take.

## OVT-FLOW-03 — Manual edits win

Manual edits to `SongBrief` fields and `LyricsDocument.text` always
override regenerated assistant output. Regenerating a field MUST require
explicit user action; the renderer must not auto-overwrite a manually
edited field after a regenerate from a sibling field.

## OVT-FLOW-04 — Generation submission

Music generation MUST consume the Kit generation lifecycle
(`useRuntimeGenerationPanel` + `RuntimeGenerationPanel`), which submits
through the SDK runtime scenario job path with
`ScenarioType.MUSIC_GENERATE` and `ExecutionMode.ASYNC_JOB`. The app
owns only the domain request projection and the completed-artifact to
`SongTake` projection. The resulting `SongTake` MUST snapshot the brief
description, lyrics text, joined style tags, duration, and instrumental
flag at completion time from the immutable submission input
(`OVT-DATA-04`).

## OVT-FLOW-05 — Job subscription discipline

After submission, job progress and artifact resolution MUST remain inside
the Kit generation lifecycle. The app must not duplicate subscription,
polling, terminal lookup, or artifact fetch orchestration. The app may
create a `SongTake` only after Kit returns a completed job with decoded
artifact bytes.

## OVT-FLOW-06 — Iteration payload

Iteration (extend / remix / reference) MUST construct its iteration
payload through an app-owned `buildMusicIterationExtensions(...)`
helper. The helper MUST serialize only to
`SubmitScenarioJobRequest.extensions[]` under
`nimi.scenario.music_generate.request`.
A renderer that passes provider-specific raw JSON or top-level fields
unrelated to the stable music input shape is a contract violation
(`OVT-RT-05`).

## OVT-FLOW-07 — Take selection

Selecting a take MUST set `selectedTakeId` to the take's `takeId`.
Selection MUST NOT mutate the take entity. Playback, iteration source
selection, and publish target derive from `selectedTakeId`.

## OVT-FLOW-08 — A/B compare

Compare mode is a transient UI state. `comparedTakeIds[0]` and
`comparedTakeIds[1]` are independent slots. Either slot may be `null`.
Exiting compare mode (clearing both slots) MUST NOT discard or rename
any take.

## OVT-FLOW-09 — Publish gating

Publish MUST be blocked at the call site unless:

1. `selectedTakeId` points at a non-discarded take with a decoded audio
   buffer in memory.
2. `realmConfigured` and `realmAuthenticated` are both `true`.
3. `PublishDraft.provenanceConfirmed === true`.

A renderer that bypasses any of these gates is a contract violation.

## OVT-FLOW-10 — Publish artifact path

Publishing MUST upload the take audio through
`uploadNimiRealmResourceFile(...)`, then call
`createNimiRealmPost(...)` with the returned resource reference plus the
`PublishDraft` metadata. The renderer must not embed the audio bytes
inline in the post payload.

## OVT-FLOW-11 — Project reset

`Close Project` clears `SongProject`, all decoded audio buffers, and any
active job subscriptions. After reset, the workspace returns to the
empty-state entry point. `Close Project` is reversible only via the
user starting a new session.
