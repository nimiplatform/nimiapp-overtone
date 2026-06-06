# Overtone — Product Overview

> Status: Active | Authority Owner: Nimi Overtone product spec

## Product Positioning

Overtone is a Tauri desktop **Nimi App** for AI-native music creation. It
is a single-purpose creation surface that proves three platform claims:

1. A standalone Nimi App can use `@nimiplatform/sdk/runtime` as the
   primary path for multimodal generation without adding any
   Overtone-specific backend.
2. The same app can publish finished outputs to Nimi Realm through
   `@nimiplatform/sdk/realm`.
3. A modern AI music UX shaped around **takes, references, and
   iteration** is reachable on the Nimi platform today.

The product loop is:

> **Brief → Lyrics → Generate candidates → Compare takes → Extend / Remix
> from references → Publish to Realm**

## Why Overtone exists

Current AI music products are converging on a few workflow expectations
that pure prompt-and-pray UIs cannot deliver:

1. Prompt-only generation is not enough; users expect to start from
   uploaded audio, previous takes, or style references.
2. Users expect iteration primitives — compare, remix, extend, trim,
   section-level review.
3. A project workspace matters more than a linear wizard once multiple
   takes exist.
4. Publish requires provenance because reference audio carries rights
   constraints.

Overtone reflects those expectations in a single shippable shape, on the
Nimi runtime + realm stack, with no parallel backend.

## Target Users

- Solo creators who want to go from idea to shareable song fast.
- Developers evaluating Nimi as a multimodal app platform.
- Content creators who need original music for video, podcast, game, and
  social content with clear provenance.

## Core Scope (Tier P0)

- Project workspace with runtime / realm / connector readiness gate.
- Song brief and lyrics assistance via runtime text streaming.
- Music generation with async job tracking and artifact decoding.
- Multi-candidate take stack with select / favorite / discard / rename.
- Reference-audio-driven extend / remix / style-reference iteration via
  the music-generation extension namespace.
- Playback, trim preview, and metadata editing.
- Realm publish with provenance confirmation.

## Tier P1

- Cover-art generation.
- Scratch / guide-vocal generation via runtime TTS.

## Tier P2

- Voice clone / voice design exploration.
- Stem-aware editing once runtime artifacts make it practical.

## Non-Goals

- Full multitrack DAW replacement.
- Precision audio editing down to bar / beat automation.
- Local mastering pipeline.
- Overtone-specific backend for music orchestration, persistence, or
  publishing.
- Hardcoded provider / model lists in the app shell.

## Architecture Position

```
nimiapp-overtone/                   # Tauri 2 desktop Nimi App
├── scaffold-managed shell glue     # auth, runtime client, Tauri bridge
│   └── src/shell/**                # (do not embed product logic here)
├── renderer-owned product code     # all workspace UX and business logic
│   └── src/overtone/**             # brief, lyrics, generate, takes, publish
├── @nimiplatform/sdk/runtime  ────→ nimi runtime (local gRPC via Tauri)
│   ├── createNimiRuntimeAIModel    # brief + lyrics assistance
│   ├── runNimiTextGenerate         # text.generate scenario helper
│   ├── runNimiRuntimeScenarioJob   # MUSIC_GENERATE async jobs
│   ├── route option helpers        # text/music model availability
│   └── ScenarioService execute/job # optional image / voice surfaces
├── @nimiplatform/sdk/realm  ──────→ nimi realm (HTTPS)
│   ├── media.upload                # take audio + cover upload
│   └── posts.create                # publish post
├── @nimiplatform/kit/auth          # desktop browser auth page
├── @nimiplatform/kit/ui            # primitives, surfaces, badges
└── @nimiplatform/kit/features/generation
                                    # RuntimeGenerationPanel + hooks
```

## Root Model Snapshot

The full data model lives in
[`kernel/data-model-contract.md`](kernel/data-model-contract.md). The
root product entities are:

- `SongProject` — a single working session: brief, lyrics, takes,
  publish draft.
- `SongBrief` — structured prompt envelope: title, genre, mood, tempo,
  description.
- `LyricsDocument` — current lyrics text plus author-edit provenance.
- `SongTake` — one generated audio candidate with lineage, origin, and
  artifact metadata.
- `GenerationJob` — runtime async-job projection used by the workspace.
- `PublishDraft` — chosen master take plus realm-publish metadata and
  provenance confirmation.

There is exactly one workspace per app instance. Multiple parallel
`SongProject` sessions are out of P0 scope.

## Differentiation vs Desktop App

| Aspect | Generic Desktop App | Overtone |
|--------|--------------------|---------|
| Scope | Full platform shell | Single-purpose music creation Nimi App |
| Primary UX | Chat / agent / platform shell | Project workspace centered on takes |
| Runtime usage | Broad platform coverage | Narrow, opinionated multimodal composition |
| Rust surface | Full runtime bridge + local AI + mods | Minimal scaffold-managed Tauri bridge |
| Auth | Platform shell auth | `@nimiplatform/kit/auth` desktop browser flow scoped to `app.nimi.overtone` |
