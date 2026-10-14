# Nimi Overtone Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, permission grant, or install truth.

## Developer Runbook

Overtone uses registry-locked Nimi packages in `package.json` (`@nimiplatform/sdk` `^0.21.0`, `@nimiplatform/kit` `^0.19.0`, and `@nimiplatform/app-tools` `^0.12.1`). Standard development does not require legacy local candidate tarballs or `scripts/setup-local-packages.mjs`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

- `pnpm dev` runs `nimi-app dev --shell electron`.
- In another terminal, `pnpm check` runs the repository `test` and `validate` checks.
- `pnpm run build:electron:production` performs the production Electron build.
- Standard `@nimiplatform/app-tools` commands (`pnpm exec nimi-app sync`, `pnpm exec nimi-app check`, `pnpm exec nimi-app test`, `pnpm exec nimi-app build --target <target>`, `pnpm exec nimi-app pack --target <target>`, and `--production` variants on matching target hosts) prepare target bundles.

## Submission Inputs and Pack Outputs

- `nimi.app.yaml` declares app identity and requested API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness and review inputs and references `.nimi/config/build-profile.yaml`.
- `.nimi/config/build-profile.yaml` is the active workflow input defining target builds, test commands, payload paths, and lockfile policy.
- Running `nimi-app pack` writes per-target `.nimiapp`, `.target.json`, and `.app-info.json` files under `dist/nimi-app/`, and `aggregate` writes `.candidate.json` (replacing the legacy `dist/nimi-app-submission.json` artifact). Listing these output paths describes the current packaging layout and does not claim that packaged artifacts exist in a fresh checkout or have passed release verification.

## Governance and Runtime Roles

- **Nimi Registry / Platform review** governs catalog admission, approved release descriptors, and ordinary-user catalog visibility.
- **Nimi Runtime** governs installation and runtime access enforcement.
- **Nimi Desktop** supervises the app process lifecycle.

## Reviewer Boundary

Overtone offers authored inspiration prompts, protected text direction and lyrics assistance, music generation with supported score conditions, recording transcription, audio separation, and reference-recording voice conversion with an App-owned vocal/accompaniment mix. MP3/WAV/FLAC import and ABC/MIDI score import, editing, and explicit conversion are App-owned workflows. Actual outputs become append-only audio versions or source-bound score estimates; transcription, timbre, and full-song quality are not inferred from a successful Job. Local audition includes trim, looping, and playback speed, with explicit original or trimmed-WAV exports. Text-based reinterpretation references words only. General audio-reference remix, continuation, and Realm publication remain unavailable.

Schema 3 project documents, adopted audio, and scores use protected Nimi App storage. One JSON catalog holds all project heads selecting verified immutable JSON document assets, each with a 16 MiB App document budget; media bytes are separate. This catalog owns only App creative document references. Browser storage holds only display preferences. There is no automatic old-development-project migration or recovery promise. Every cleanup entry, including retry, requires confirmation. Cleanup reads all catalogued documents before deleting anything and retains data if a document is missing or unreadable. It protects the current project, in-flight operations, pending recovery data, unsaved local completions, and explicit audio exports. Cleanup does not cancel Runtime Jobs. User-requested exports remain separate from Realm publication.

Music generation, transcription, and voice conversion persist an author submission identity before Submit; recovery queries that identity or the original Job without resubmission. Separation recovers only an already captured `jobId`. Completed output becomes visible only after its project head commits; failed saves preserve pending recovery and valid adopted output. Runtime status and decoded PCM remain transient. Writing consumes the protected cancellable text stream. Publication actions and the independent dev-preview entry have been removed. Local checks are self-checks, and no release, catalog admission, or installed-runtime acceptance is claimed.
