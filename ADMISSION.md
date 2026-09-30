# Nimi Overtone Nimi Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, permission grant, or install truth.

## Developer Runbook

Obtain the exact reviewed local candidate archives first; see README for the complete host combination and public-release boundary.

```bash
node scripts/setup-local-packages.mjs /path/to/reviewed-candidate-archives
pnpm install --frozen-lockfile
pnpm dev -- --cdp-port 9222
pnpm run check
pnpm run pack
```

## Submission Inputs

- `nimi.app.yaml` declares app identity and requested API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness commands and review inputs.
- `.nimi/admission/build-profile.yaml` records install, init, build, and lockfile policy.
- `dist/nimi-app-submission.json` is produced by `pnpm run pack` after a successful renderer build.

## Reviewer Boundary

Overtone offers authored inspiration prompts, protected text direction and lyrics assistance, music generation with supported score conditions, recording transcription, audio separation, and reference-recording voice conversion with an App-owned vocal/accompaniment mix. MP3/WAV/FLAC import and ABC/MIDI score import, editing and explicit conversion are App-owned workflows. Actual outputs become append-only audio versions or source-bound score estimates; transcription, timbre and full-song quality are not inferred from a successful Job. Local audition includes trim, looping and playback speed, with explicit original or trimmed-WAV exports. Text-based reinterpretation references words only. General audio-reference remix, continuation and Realm publication remain unavailable.

Schema 3 project documents, adopted audio and scores use protected Nimi App storage. One JSON catalog holds all project heads selecting verified immutable JSON document assets, each with a 16 MiB App document budget; media bytes are separate. This catalog owns only App creative document references. Browser storage holds only display preferences. There is no automatic old-development-project migration or recovery promise. Every cleanup entry, including retry, requires confirmation. Cleanup reads all catalogued documents before deleting anything and retains data if a document is missing or unreadable. It protects the current project, in-flight operations, pending recovery data, unsaved local completions and explicit audio exports. Cleanup does not cancel Runtime Jobs. User-requested exports remain separate from Realm publication.

Nimi Platform review owns final admission, release descriptors, ordinary-user visibility, install availability, and permission grants.

Music generation, transcription and voice conversion persist an author submission identity before Submit; recovery queries that identity or the original Job without resubmission. Separation recovers only an already captured jobId. Completed output becomes visible only after its project head commits; failed saves preserve pending recovery and valid adopted output. Runtime status and decoded PCM remain transient. Writing consumes the protected cancellable text stream. Publication actions and the independent dev-preview entry have been removed. Development uses a complete pinned SDK 0.19 / Kit and host-native 0.16 / App Tools 0.11.4 archive combination; the preparation command and lockfile pin its exact bytes. Public-release preflight requires registry resolutions. Local checks are self-checks, and no release, admission or installed-runtime acceptance is claimed.
