# Overtone Runtime Integration Contract

Rule family: `OVT-RT-*`. Admitted SDK runtime surfaces, expected call
shapes, and forbidden patterns.

## OVT-RT-01 — SDK entry point

The renderer MUST obtain the runtime through `getPlatformClient().runtime`
or the equivalent helper from `@nimiplatform/sdk`. Direct construction
of any platform client through `createPlatformClient(...)` is forbidden
in the renderer (`OVT-AUTH-02`).

## OVT-RT-02 — Text streaming

Brief and lyrics assistance MUST call
`runtime.ai.text.stream(...)` with at minimum:

```ts
{
  model: selectedTextModelId,
  connectorId: selectedTextConnectorId,
  input: string,
  system?: string,
  temperature?: number,
  maxTokens?: number,
}
```

The renderer MUST consume `output.stream` as an async iterator,
handling `{ type: 'delta', text }` and `{ type: 'error', error }`
parts. A renderer that ignores `error` parts is a contract violation.

## OVT-RT-03 — Music generation submission

Music generation MUST use either:

- `runtime.media.music.generate({ ... })` for the high-level helper
  path, or
- `runtime.media.jobs.submit({ modal: 'music', input })` followed by
  `runtime.media.jobs.subscribe(jobId)` for fine-grained control.

The stable input shape is:

```ts
type MusicGenerateInput = {
  model: string;
  connectorId: string;
  prompt: string;
  lyrics?: string;
  style?: string;
  title?: string;
  durationSeconds?: number;
  instrumental?: boolean;
  extensions?: Record<string, unknown>;
};
```

## OVT-RT-04 — Async job lifecycle

For job-level control the renderer MUST follow:

1. `submitted = await runtime.media.jobs.submit({ modal, input })`
2. iterate `await runtime.media.jobs.subscribe(submitted.jobId)`
3. stop on terminal status `COMPLETED | FAILED | CANCELED | TIMEOUT`
4. if non-terminal at iterator end,
   `await runtime.media.jobs.get(submitted.jobId)` once
5. `await runtime.media.jobs.getArtifacts(submitted.jobId)` only after
   the terminal status is `COMPLETED`

Calling `getArtifacts` before a terminal-completed status is a contract
violation.

## OVT-RT-05 — Iteration extension namespace

Reference-audio, extend, remix, and style-reference iteration MUST go
through `extensions` with the namespace
`nimi.scenario.music_generate.request`. The renderer MUST construct the
payload through an app-owned helper
(`buildMusicIterationExtensions(...)`) and MUST NOT expose raw provider
JSON to end users.

## OVT-RT-06 — Readiness probes

Readiness probes MUST use:

- `runtime.ready({ timeoutMs })` for liveness
- `runtime.ai.listScenarioProfiles({})` for scenario discovery
- `runtime.connector.listConnectors({ pageSize })` for connector
  inventory
- `runtime.connector.listConnectorModels({ connectorId, pageSize })`
  for model availability

A renderer that infers readiness by submitting a probe generation job
is a contract violation; readiness probes must not consume credits.

## OVT-RT-07 — Optional surfaces (P1)

Cover-art generation MAY call `runtime.media.image.generate(...)` with a
non-empty model id and aspect ratio. Guide-vocal generation MAY call
`runtime.media.tts.synthesize(...)` and `runtime.media.tts.listVoices(...)`.
Both surfaces stay optional and MUST NOT gate the P0 loop.

## OVT-RT-08 — Voice asset surfaces (P2)

Voice clone / voice design experimentation MAY use
`runtime.ai.submitScenarioJob` with `VOICE_CLONE` / `VOICE_DESIGN` and
the listing / delete surfaces. These remain experimental and MUST NOT be
required by any P0 / P1 feature.

## OVT-RT-09 — Reason-code propagation

Runtime reason codes returned on job failure, connector failure, or
schema failure MUST be propagated to the user via the mapping in
`tables/error-reason-handling.yaml`. The renderer must not swallow,
rewrite, or coerce reason codes into a generic "something went wrong"
message.

## OVT-RT-10 — Forbidden runtime patterns

- Calling `runtime.account.completeLogin` with a non-empty `refreshToken`
  (must be empty string at the wire level; runtime fail-closes
  `PROOF_UNSUPPORTED`).
- Reading from `runtime/internal/**` in any source path.
- Treating `runtime.ready()` failure as a soft warning that lets
  music-generation calls proceed.
- Submitting `runtime.media.jobs.submit` with `modal` other than
  `'music'`, `'image'` (P1), or `'tts'` (P1).
