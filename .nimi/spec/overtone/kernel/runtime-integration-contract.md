# Overtone Runtime Integration Contract

Rule family: `OVT-RT-*`. Admitted SDK runtime surfaces, expected call
shapes, and forbidden patterns.

## OVT-RT-01 — SDK entry point

The renderer MUST obtain runtime access through the app-scoped
`NimiClient` helper (`getOvertoneNimiClient()` or equivalent
`createNimiClient(...)` bootstrap). Direct construction through
legacy `createPlatformClient(...)` is forbidden in the renderer
(`OVT-AUTH-02`).

## OVT-RT-02 — Text generation

Brief and lyrics assistance MUST call the SDK AI runtime helper:
`createNimiRuntimeAIModel(...)` plus `runNimiTextGenerate(...)`.
The model binding MUST come from the readiness route projection and
MUST include:

```ts
{
  routePolicy: 'cloud',
  connectorId: selectedTextConnectorId,
  model: { providerId: selectedTextConnectorId, modelId: selectedTextModelId },
  messages: NimiMessage[],
  system?: string,
  temperature?: number,
  maxTokens?: number,
}
```

The renderer MUST fail closed before dispatch if no route model is
available. Treating an implicit Runtime default, placeholder model,
or empty connector/model pair as success is a contract violation.

## OVT-RT-03 — Music generation submission

Music generation MUST use `runNimiRuntimeScenarioJob(...)` with a
`SubmitScenarioJobRequest` carrying `ScenarioType.MUSIC_GENERATE` and
`ExecutionMode.ASYNC_JOB`. The helper owns the submit / event
subscription / terminal lookup / artifact fetch sequence over
`runtime.ai.submitScenarioJob`, `subscribeScenarioJobEvents`,
`getScenarioJob`, and `getScenarioArtifacts`.

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
  extensions?: readonly ScenarioExtension[];
};
```

## OVT-RT-04 — Async job lifecycle

For job-level control the renderer MUST follow:

1. submit `SubmitScenarioJobRequest` through `runtime.ai.submitScenarioJob`
2. iterate `runtime.ai.subscribeScenarioJobEvents({ jobId })`
3. stop on terminal status `COMPLETED | FAILED | CANCELED | TIMEOUT`
4. if non-terminal at iterator end, call
   `runtime.ai.getScenarioJob({ jobId })` once
5. call `runtime.ai.getScenarioArtifacts({ jobId })` only after
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
- `listNimiRuntimeRouteOptionsWithHost({ capability: 'text.generate' }, createNimiRuntimeRouteOptionsHostDeps(runtime))`
  for text route availability
- `listNimiRuntimeRouteOptionsWithHost({ capability: 'music.generate' }, createNimiRuntimeRouteOptionsHostDeps(runtime))`
  for music route availability

A renderer that infers readiness by submitting a probe generation job
is a contract violation; readiness probes must not consume credits.

## OVT-RT-07 — Optional surfaces (P1)

Cover-art generation MAY use `runtime.ai.executeScenario` with
`ScenarioType.IMAGE_GENERATE`. Guide-vocal generation MAY use
`runtime.ai.executeScenario` with `ScenarioType.SPEECH_SYNTHESIZE` and
the generated voice-listing surfaces when admitted. Both surfaces stay
optional and MUST NOT gate the P0 loop.

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
- Submitting Scenario jobs with scenario types other than
  `MUSIC_GENERATE` for the P0 loop, or optional admitted P1/P2 scenario
  types for explicitly optional surfaces.
