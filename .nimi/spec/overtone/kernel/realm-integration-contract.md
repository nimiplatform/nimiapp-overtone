# Overtone Realm Integration Contract

Rule family: `OVT-REALM-*`. Admitted SDK realm surfaces and publish
flow rules.

## OVT-REALM-01 — SDK realm entry point

Realm access MUST go through `getPlatformClient().domains.resources` or
the equivalent `@nimiplatform/sdk` realm helper exposed by the platform
client. Direct construction of a realm HTTP client inside Overtone is
forbidden.

## OVT-REALM-02 — Realm readiness

Realm readiness MUST be inferred from:

- `realmConfigured`: the realm base URL has been provided to the SDK
  helper at bootstrap time.
- `realmAuthenticated`: the runtime account session projection reports
  an authenticated realm-capable user.

A failed first realm business call MUST surface the actual reason code,
not flip `realmAuthenticated` back to `false` retroactively.

## OVT-REALM-03 — Audio upload

Audio upload MUST use the SDK resources helper, in this order:

1. `client.domains.resources.createAudioDirectUpload({ mimeType })` to
   reserve a `resourceId` and `uploadUrl`.
2. `fetch(uploadUrl, { method: 'PUT', body: audioBlob, headers })` to
   upload the bytes directly.
3. `client.domains.resources.finalizeResource(resourceId, { mimeType,
   durationSec?, title?, tags? })` to finalize the resource record.

Embedding the audio bytes inline in `createPost` payloads is a contract
violation.

## OVT-REALM-04 — Post creation

`client.domains.resources.createPost({ caption, attachments, tags? })`
MUST be the publish entry point. `attachments` MUST reference the
finalized audio `resourceId` with type `AUDIO`. Cover art (P1) is an
additional attachment with type `IMAGE`.

## OVT-REALM-05 — Provenance confirmation

A publish call MUST NOT be issued until
`PublishDraft.provenanceConfirmed === true`. The renderer must surface
the confirmation as an explicit checkbox-style affordance bound to a
human-readable rights statement.

## OVT-REALM-06 — Source-mode metadata

The `sourceMode` of the published take MUST match the take's `origin`:

| Take `origin` | `sourceMode` |
|---------------|--------------|
| `prompt`      | `prompt-only` |
| `extend`      | `derived-take` |
| `remix`       | `derived-take` |
| `reference`   | `uploaded-audio` |

A renderer that publishes a take with a mismatched `sourceMode` is a
contract violation.

## OVT-REALM-07 — Failure handling

Realm upload failures (`uploadResponse.ok === false`), finalization
errors, or post-creation errors MUST surface as typed publish errors
with `publishStatus = 'error'` and `publishError = <message>`. The
renderer MUST NOT roll back to `'idle'` automatically; the user must
dismiss the error explicitly. Retry MUST start from
`createAudioDirectUpload(...)`.

## OVT-REALM-08 — Out-of-scope realm surfaces

Realm comment, follow, like, repost, profile-edit, and DM surfaces are
out of scope for Overtone P0 / P1 / P2. A renderer that links to or
embeds those surfaces is a contract violation against
`OVT-REMOVED-*`.
