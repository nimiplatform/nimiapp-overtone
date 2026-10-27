Current development dependencies are SDK 0.22.2, Kit/native 0.22.1, App Tools 0.14.0 and Nimi Coding 0.7.0. The checked-in pnpm lock resolves these packages from the public registry. Run `pnpm install --frozen-lockfile`, `pnpm exec nimi-app check`, then `pnpm dev` with a matching source-built Nimi Runtime and Home. App versions and published App releases are unchanged. Earlier versioned notes retain their original acceptance scope. Home uses the App-owned root `NIMI_APP.md`; this README remains developer documentation.

Upgrade verification: public-registry installation, frozen-lockfile installation, App Tools checks and the applicable type/Host build checks passed. Desktop-supervised macOS development opened the saved music workspace and AI configuration. New model-output journeys and packaged installation were not rerun; earlier evidence below retains its stated versions and scope.

[App introduction and usage](NIMI_APP.md)

# Overtone (泛音)

> An AI-native music composition playground and audio workstation for desktop.

Overtone transforms fleeting musical intuitions into complete songs and audio tracks. Whether you start with a lyrical idea, an atmospheric scene, or a raw audio recording, Overtone helps you explore distinct musical directions, refine arrangements, and craft high-fidelity audio—using the Local or Cloud routes you configure in Nimi.

---

## The Studio Experience

Overtone combines generative musical exploration with the tactile controls of a modern audio editor:

### 1. The Sound Coordinates
Guide AI generation across an intuitive 2D creative plane (coordinates shape the creative prompt rather than acting as exact or guaranteed acoustic controls):
- **Horizontal Axis (Energy)**: Express the groove, tempo, and intensity you want.
- **Vertical Axis (Surprise)**: Express a preference for familiar territory or unexpected musical ideas.
- Each exploration produces **three distinct musical directions** to audition and compare.

### 2. Arrangement & Lyric Notebook
- Expand any promising motif into a structured arrangement (e.g. 1.5 min, 2 min, or 3 min).
- Edit lyrics section by section (Intro, Verse, Chorus, Bridge, Outro) with automatic lyric formatting and acoustic styling notes.
- Request full song generation while preserving your customized verse structures.

### 3. The Recording Shelf & A/B Audition
- **Per-Take History**: Each successfully completed and saved generation is kept as an independent, non-destructive take on your shelf.
- **A/B Audition**: Switch between takes at your current playback position whenever it falls within the target take's valid range; otherwise, playback starts from the target's playable beginning (loading audio may take a moment).
- **Precision Playback**: Loop sections, adjust playback tempo without affecting exported pitch, and visually trim audio waveforms.
- **Clean Export**: Reveal the saved original file directly, or export a trimmed clip as a separate `float32` WAV in App storage and reveal the completed file. Audition speed and volume adjustments never alter exported audio.

### 4. Advanced Audio Lab
- **Stem Separation (`audio.separate`)**: Isolate vocals and instrumental backing tracks using local Demucs models.
- **Music Transcription (`music.transcribe`)**: Extract an editable ABC score sketch from a recording. MIDI import and editing are separate score workflows.
- **Voice Conversion (`audio.voice-convert`)**: Re-render vocal tracks using a separate reference recording as a vocal persona.

---

## AI Capabilities Required

Configure these capabilities in Nimi Home for Overtone:
- **Creative Writing (`text.generate`)**: Generates lyrics, musical proposals, and arrangement structures.
- **Music Generation (`music.generate`)**: Renders audio clips and full multi-section tracks.
- **Stem Separation (`audio.separate`)** *(Optional)*: Demucs model for vocal/instrumental separation.
- **Music Transcription (`music.transcribe`)** *(Optional)*: Generates score sketches from audio.
- **Voice Conversion (`audio.voice-convert`)** *(Optional)*: Uses a reference recording to guide voice conversion.

All audio files, projects, and score documents are securely managed within Nimi's local application storage.

---

## Getting Started & Development

### Prerequisites
- [Nimi Desktop](https://nimi.ai/download) or local dev environment.
- Ready text and music capabilities configured in Nimi Home.

### Running Locally
```bash
# Install dependencies cleanly
pnpm install --frozen-lockfile

# Sync managed configuration
pnpm exec nimi-app sync

# Launch in Desktop-supervised Electron shell
pnpm dev -- --cdp-port 9222
```

### Verification & Testing
```bash
pnpm run typecheck
pnpm run test
pnpm exec nimi-app check --production
```

### Packaging for Release
```bash
# macOS
pnpm exec nimi-app build --target macos-aarch64 --production
pnpm exec nimi-app pack --target macos-aarch64 --production

# Windows
pnpm exec nimi-app build --target windows-x86_64 --production
pnpm exec nimi-app pack --target windows-x86_64 --production
```

---

## Storage & Privacy Architecture

- **Protected App Storage**: All project JSON documents, audio recordings, and musical scores are stored locally through Nimi App storage.
- **Project Documents & Task Recovery**: Project states use atomic `schema-3` commits. Saved recovery IDs allow the app to query an unfinished task after reopening rather than resubmitting it, subject to task expiry and provider status. Recovery cannot be guaranteed for expired or unconfirmed tasks, nor does it guarantee against provider billing.
- **AI Data Flow**: Nimi Runtime manages provider credentials. While project assets stay local, local storage does not imply local-only inference—selecting a Cloud route sends the text or audio required for the current request to your chosen provider.

---

## Release & Verification Status

- **Verified Publisher Release**: [v0.1.8](https://github.com/nimiplatform/nimiapp-overtone/releases/tag/v0.1.8)
- **Registry Admission**: [#81](https://github.com/nimiplatform/nimi-app-registry/pull/81) (macOS arm64 and Windows x64)
- **Recorded Toolchain Combination**: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, Nimi Coding 0.6.5
- **Previously Recorded Platform Checks**: macOS arm64 Catalog install, 3-direction proposal generation, 30s music rendering, audio playback, local persistence across restarts, and WAV export confirmed. (Windows GUI execution marked as `NOT-VERIFIED`).
