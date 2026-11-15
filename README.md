## Current local cohort — 2026-11-15

Overtone remains **0.1.8**. Complete SDK **0.24.0-rc.2**, Kit **0.24.0-rc.4**, Windows native **0.24.0-rc.1** and App Tools **0.16.0-rc.2** archives are selected through explicit overrides and the lockfile from `.nimi/local/packages/integration-20261114-android-http-rc.4`. Kit's declaration stays `^0.24.0-rc.1`; the override selects rc.4. Coding 0.7.0, Electron 45, original sources, model choices and saved music data are preserved. The actual Android plugin uses the shared `CoordinationHttpClient` fix without changing retry/cookie/redirect policy. This does not identify the cause of older intermittent network errors.

The old flat local Web declaration was refused by the new tool. Its original **4474** origin/callback and `nimi.overtone.web.dev` client now live under `local_development.web.local`, without a second source or permission expansion. Use `pnpm dev:web -- --realm local` and `NIMI_DEV_REALM=local` for Web/mobile builds. Normal sync updated the managed guides. `setup:packages` now derives each concrete archive version independently from its reviewed locked override, rather than assuming the Kit caret minimum or native version equals the Kit archive version. Metadata/sha512 checks remain, and differing existing archives are refused instead of overwritten. A focused regression and the real complete-cohort preparation command passed.

Offline frozen installation, App Tools check, renderer/Host types, **21 existing storage/scope/media/entry tests**, the additional package-preparation regression, Desktop/Web/mobile builds and offline Android assembly passed. The signed APK is `.nimi/local/android-candidates/20261115-065810-kit-rc4/overtone-0.1.8-kit-rc4-debug.apk`: **13,049,450 bytes**, SHA-256 `80B984095CDFC606932ED2E96B052A167EF0B98D20D9662BA12B8ABCC73829EA`, with the existing certificate `756e56a08527a94e830921233bc80f31121fd0fe57dccef1535e27e9eb0a6585`. Old archives remain intact.

Real Web Halliday login reused the existing source and read the original **10 recordings**, selected **檐下的书香 version 13** at 0:00/0:19, recovery entries for versions 4/5/11, and the two existing 4:20 imports. Formal Disconnect reached the real disconnected gate; the first Connect restored the same records, selected version and position. No playback, recovery audition, generation, recording or export was requested in that Web slice. The new APK has been installed with data retained, but its Android launch/content/idle-first-connect slice has not yet run while the shared AVD is being recovered after a system ANR. It remains **NOT-VERIFIED** for this cohort; older results below keep their recorded scope.

# Previous local Android / layout iteration — 2026-11-13

Follow-up Web acceptance on the restored local Runtime reused Halliday and the same admitted source. The original 10 Web recordings and recovery entries remained; the existing version 13 audio played with progress reaching the end, without a new generation. At 390×844, the preferences account row clipped the sign-out action. The App now wraps account controls inside the same padded settings group; the actual popover and scroll width both measured 264 px and all controls and the sign-out warning were visible. Desktop viewport was restored. Type/style/App Tools checks and the rebuilt Android APK passed, and `adb install -r` retained data. After the coordinated local restart, Android completed normal Halliday login and loaded the original “Android rain-window test - Take 1” recording. The actual Android preferences popover also measured clientWidth/scrollWidth 264, with the full account, disconnect/sign-out actions and save warning visible. Screenshot: `.nimi/local/ui-audit/2026-11-13-web-android/android-preferences-fixed.png`. No new music was generated in this follow-up.

The fixed local combination is SDK / Kit / Windows source-native `0.23.1-rc.1` and App Tools `0.15.1-rc.1`, selected by the manifest, overrides and lockfile from `.nimi/local/packages/web-android-20261113-rc.1`. Never replace archive content under the same version. A local Capacitor Android entry uses Kit mobile login and the same captured Runtime client, Job observation, project storage and asset reader. Local test identity: `ai.nimi.apps.overtone.dev`, client `nimi.overtone.android.dev`, callback `ai.nimi.apps.overtone.dev:/oauth/callback`. The scheme and loopback cleartext configuration are debug-only; this is not public Android distribution or an App Link claim.

Run `pnpm sync:android`, then Android Gradle `assembleDebug` with JDK 21 / Android SDK, or use `pnpm dev:mobile`. The rebuilt API 36 APK completed official Halliday login, Home source confirmation and direct My PC access. A real local MiniMax Music3 audio.cpp request produced “Android rain-window test - Take 1” (about 19 seconds); playback progressed to its end and the system share sheet received `result.wav`. Canceling that sheet initially produced a false “Audio unavailable” error. The Android delivery owner now distinguishes the native cancellation from other errors; the rebuilt APK was reinstalled with data retained and cancellation was verified without that warning. Normal re-login read the same one recording, without generating another take. Receiving-app save, large-file device behavior, import and rotation remain **NOT-VERIFIED**.

Android playback and export stage selected assets with 64 KiB native writes, preserving binary chunks without creating a whole-file Blob/base64 string. Playback uses the Capacitor local file URL and releases its temporary file with the media handle. Three focused tests cover byte integrity, disconnected staging and native share cancellation versus real failure; typecheck and the rebuilt APK pass. Large-file playback is not established by the 19-second device result.

Android file delivery uses the official Capacitor [Filesystem](https://capacitorjs.com/docs/apis/filesystem) and [Share](https://capacitorjs.com/docs/apis/share) APIs. An explicit export reads the selected protected App asset, writes a uniquely named App-private cache copy and opens the system share sheet. FileProvider exposes only this export directory. UI copy distinguishes saving/sharing from Desktop reveal or Web download; opening the sheet does not assert that another app saved the file. Canonical source media stays on Runtime.

UI audit captured the existing Desktop-supervised workspace and a 360px renderer (temporary device metrics cleared afterward). Prior project and three recordings remained. The selected 19-second take played while muted to visible 0:18; playback was paused and the original volume 80 restored. Touch controls grew from 26–34px to at least 44px, the coordinate control is easier to touch, AI settings stays labelled, and export retains a visible action label. Main content scrolls independently of the persistent transport without horizontal page overflow. This is real shared-renderer layout/playback evidence, not an Android media pass. Screenshots: `.nimi/local/ui-audit/2026-11-13-web-android`; full accessibility and physical-device/network testing remain unverified.

Actual Vite module-graph tests now ensure both Web and Android bundles use their remote entry; the former post-transform hook could silently bundle the Desktop entry. The 127 tests, App Tools/style checks, renderer/Host builds and 180-unit authority check/compile pass. Earlier Web music-Job recovery results below are reused within their original scope.

# Previous Web coordination acceptance — 2026-11-12

The current development combination is SDK 0.23.0, Kit/native 0.23.0, App Tools 0.15.0 and Nimi Coding 0.7.0, selected through the complete local archives in `pnpm-workspace.yaml` and pinned by `pnpm-lock.yaml`. SDK and Kit were rebuilt from the current Nimi presence-coordination implementation. The supplied App Tools/native archives are existing local candidates. Obtain the exact locked archives with the existing `setup:packages` workflow; this is local development consumption, not publication or public-registry release verification.

The approved Web source `https://127.0.0.1:4474` now connects through the new Redis-presence protocol. The old SDK rejected the removed `primary.leaseExpiresAt` field; upgrading the complete dependency combination resolves that contract mismatch without changing App authorization or adding a compatibility path. Existing account and Home source approval were reused.

Real Chrome acceptance used the configured local MiniMax Music3 model: disconnect while a music Job was running, reconnect without another submission, then use **恢复试听** to read the original Job ID and save its completed audio. The target action sent one Submit, no Cancel, no Job calls during reconnect alone, and two Get calls for the same ID during recovery. The shelf gained one version; its roughly 20-second audio played to the end. The temporary transport observer was removed and volume restored. App Tools sync/check, all 123 tests, typecheck and Web build passed. Native Desktop, Android and public-network journeys were not rerun for this dependency combination.

## Earlier development notes

Web adaptation in progress (2026-11-10): upstream https://github.com/nimiplatform/nimiapp-overtone, baseline `main@c5e16f2`, MIT, unlaunched candidate. The user authorized continued local multi-App adaptation; no source admission, public release or new account is implied. Use the complete RRA SDK 0.22.2 / Kit 0.22.1 / App Tools 0.14.0 package set through explicit local tarball overrides. This changes dependency selection and requires a refreshed lockfile; previous published-package evidence retains its original scope.

Bounded implementation: keep the music workspace, lyrics, score editing, multi-step generation, existing Job lookup and audio-processing workflows. Replace native-only account glue with the shared Kit Desktop/Web factories and capture a per-connection client in the product context. Keep Runtime-owned projects/assets and existing disposal/cancellation; do not add a browser project database or replay failed submissions. Native file reveal remains a native action; Web must offer actual download of the selected owned audio/score bytes. The new Web source and first Home confirmation are pending operator conditions. Verify text exploration, actual audio import/playback/export and supported configured jobs through the App, separating unconfigured capabilities and unrun Web paths from passed checks.

Current local commands: `pnpm dev -- --list-registrations` and `pnpm dev -- --resume <current-selector>` for the intended existing native project; `pnpm dev:web` after configuring the trusted TLS paths in `.env.web.local`; `pnpm run build:web` builds `dist-web`. Source proposal: App `nimi.overtone`, client `nimi.overtone.web.dev`, origin `https://127.0.0.1:4474`, callback `/`, App Access `runtime.consume`, ordinary App role. This is not an admitted Registry record; the new source and first Home confirmation remain pending. The same-package own reference was generated, installed and passed init/check/build; no reference Runtime success is claimed without admission.

Verified in this iteration: 122 tests, renderer types, native/Web builds, App Tools/style checks, Nimi Coding doctor and 180-unit authority check/compile. Actual Desktop-supervised launch retained the previous project and recording. The App generated three real text directions, adopted one as the draft, imported a generated 3-second WAV as an explicitly imported recording, played it to the visible end while muted, and saved a 1–3-second crop. A new actual music Job completed, adopted its audio and showed a 19.981-second version. Chrome opened the declared HTTPS Web login entry. Scope/queue regression tests are component and storage tests, not claims of real remote authentication.

The local SDK package is now updated to Nimi `968ed7405` incremental asset streaming, removing the former 32 MiB aggregate upload restriction while retaining Runtime owner limits. The matching Runtime and shared Lab Web completed a real 40 MiB transfer/read-back and a canceled partial-upload check. Overtone kept its public dependency declarations and App code; 122 tests and its Web build pass against the updated complete package. This does not replace Overtone's own pending Web acceptance. Full Web login, AI, audio/media and account transitions remain **NOT-VERIFIED** until this App's source is admitted; unrun voice conversion, separation, transcription and target-OS journeys are not inferred from the passed paths.


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
