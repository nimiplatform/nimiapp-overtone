# Overtone Data Model Contract

Rule family: `OVT-DATA-*`. Entities, fields, and invariants for Overtone
renderer state. All entities live inside the renderer; there is no
persisted server-side schema.

## OVT-DATA-01 — `SongProject`

```ts
type SongProject = {
  projectId: string;          // ULID, unique per active session
  createdAt: number;          // ms epoch
  brief: SongBrief | null;
  lyrics: LyricsDocument | null;
  takes: SongTake[];          // append-only within a session (see OVT-DATA-06)
  selectedTakeId: string | null;
  comparedTakeIds: [string | null, string | null]; // A/B slots
  draftPost: PublishDraft | null;
  readiness: ReadinessSnapshot;
};
```

A session has exactly one active `SongProject`. Closing the project
clears the entity and any decoded audio buffers from memory.

## OVT-DATA-02 — `SongBrief`

```ts
type SongBrief = {
  title: string;        // <= 80 chars, may be empty before assistant fill
  genre: string;        // free-text, no enum
  mood: string;         // free-text, no enum
  tempo: string;        // free-text ("slow" / "moderate" / "fast" / BPM hint)
  description: string;  // <= 1500 chars, the canonical creative direction
};
```

`SongBrief` is the structured prompt envelope. Manual edits always win
over assistant regeneration (`OVT-FLOW-03`).

## OVT-DATA-03 — `LyricsDocument`

```ts
type LyricsDocument = {
  text: string;                  // canonical lyrics (may include section labels)
  source: 'assistant' | 'manual' | 'mixed';
  updatedAt: number;
};
```

Switching from `assistant` to manual editing transitions `source` to
`mixed` on the first manual character change.

## OVT-DATA-04 — `SongTake`

```ts
type SongTake = {
  takeId: string;                  // ULID
  parentTakeId?: string;           // populated for extend / remix / reference
  origin: TakeOrigin;              // see tables/take-origin-catalog.yaml
  title: string;                   // <= 80 chars
  jobId: string;                   // runtime scenario job id
  artifactId?: string;             // first artifact id, if returned
  promptSnapshot: string;          // brief.description at submission time
  lyricsSnapshot?: string;         // lyrics text at submission time
  styleSnapshot?: string;          // joined style tags / genre+mood
  durationSeconds?: number;        // request duration (sec)
  instrumental?: boolean;          // request instrumental flag
  favorite: boolean;               // user-marked
  discarded: boolean;              // soft-discard flag (UI hides discarded)
  createdAt: number;
};
```

`origin` MUST be a value admitted by `tables/take-origin-catalog.yaml`.
A renderer that writes any other value to `origin` is a contract
violation.

## OVT-DATA-05 — `TakeArtifact` projection

The runtime returns `ScenarioArtifact` objects. The renderer projects
each into an in-memory `TakeArtifact`:

```ts
type TakeArtifact = {
  takeId: string;
  artifactId: string;
  mimeType: string;          // verified non-empty before decoding
  bytes: ArrayBuffer | null; // null until decoded copy lands
  decoded: AudioBuffer | null;
};
```

Decoded audio buffers MUST NOT be persisted outside the renderer
session. They are cleared on take discard, project reset, and app close.

## OVT-DATA-06 — Append-only takes

Within a single session, takes are append-only. The user can
`favorite`, `rename`, `discard` (sets `discarded = true`), but cannot
mutate `jobId`, `artifactId`, `promptSnapshot`, `lyricsSnapshot`, or
`createdAt` on an existing take. A renderer that mutates these fields is
a contract violation.

## OVT-DATA-07 — `GenerationJob`

```ts
type GenerationJob = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled' | 'timeout';
  progressLabel?: string;     // human-readable status from runtime
  errorMessage?: string;
};
```

A `GenerationJob` is a transient projection only; it MUST NOT replace
the take entity. A completed job that produces an artifact MUST also
produce a `SongTake` (`OVT-PROD-05`).

## OVT-DATA-08 — Local persistence boundary

Local persistence is scoped to the renderer or the scaffold-managed
Tauri shell. Permitted stores:

- In-memory React state (default).
- `localStorage` keyed under `nimi.overtone:*`, used only for non-secret
  user preferences (e.g. last accent override).

Forbidden:

- Any token, refresh token, subject user id, oauth code, or session
  cookie in `localStorage`, `sessionStorage`, or IndexedDB (see
  `OVT-AUTH-03`).
- Mirroring runtime / realm responses across app restarts.

## OVT-DATA-09 — `PublishDraft`

```ts
type PublishDraft = {
  takeId: string;
  title: string;
  description: string;
  tags: string[];
  sourceMode: 'prompt-only' | 'uploaded-audio' | 'derived-take';
  provenanceConfirmed: boolean;
};
```

`provenanceConfirmed` MUST be `true` before the renderer is allowed to
invoke `realm.media.upload(...)` for the take. Source must enforce this
at the publish call site.

## OVT-DATA-10 — `ReadinessSnapshot`

```ts
type ReadinessSnapshot = {
  runtimeStatus: 'checking' | 'ready' | 'degraded' | 'unavailable';
  runtimeErrorMessage?: string;
  textConnectorAvailable: boolean;
  musicConnectorAvailable: boolean;
  selectedTextConnectorId?: string;
  selectedTextModelId?: string;
  selectedMusicConnectorId?: string;
  selectedMusicModelId?: string;
  realmConfigured: boolean;
  realmAuthenticated: boolean;
};
```

`ReadinessSnapshot` is recomputed on each readiness pass
(`OVT-FLOW-01`). The shape of `selected*` fields is a direct projection
of `runtime.connector.listConnectors` + `listConnectorModels`; the
renderer must not synthesize ids that runtime did not return.
