# Nimi Overtone User Guide

Welcome to Nimi Overtone—an AI music exploration playground and audio studio powered by your personal Nimi Runtime. Start from a mood, a scene, or a few lines of lyrics to explore distinct musical directions, arrange full multi-section songs, edit ABC/MIDI scores, and audition non-destructive takes.

## Connection, Platforms & Account

- **Desktop (macOS / Windows)**: Launch from Nimi Home to inherit your active Home account and connect directly to your local Runtime.
- **Web (Published)**: Open [overtone.nimi.xyz](https://overtone.nimi.xyz/) (or launch from [nimi.ai/apps/overtone](https://nimi.ai/apps/overtone)) and sign in with your official Nimi account to connect to your primary PC Runtime. First-time access requires one-time source confirmation in Nimi Home on your primary PC; routine content updates reuse that grant unless the source or requested permissions change materially.
- **Android Preview**: Remains a local test build and is not publicly released yet.

Keep Nimi Home and Runtime running on your primary PC while working. If the connection drops, unsaved edits remain on the current page so you can explicitly retry saving or check original jobs once reconnected—Overtone never silently resubmits generation jobs. Signing out or closing the page clears unsaved edits. Account actions live in Preferences; signing out on the Web ends only this App's session.

---

## Creative Workflow

### 1. Sound Coordinates & Three Musical Worlds
- Enter a scene, feeling, or musical prompt—or use **Borrow a spark** and **Collide ideas** for quick inspiration.
- Drag the marker on the 2D **Sound coordinates** graphic score pad to steer creative intent (coordinates guide the creative prompt rather than acting as exact acoustic parameters):
  - **Horizontal axis (Energy)**: Moves from weightless stillness to full-force drive.
  - **Vertical axis (Surprise)**: Moves from familiar structures to adventurous genre crossings.
- Click **Explore 3 directions** to generate three genuinely distinct musical worlds with arrangement briefs and lyric sketches—or open **Sound notes & lyrics** directly to write manually.

### 2. Sketches & Full Song Arrangement
- **Audition sketches**: Apply any direction and render a short sketch; completed takes record their actual rendered duration.
- **Expand into a full song**: Pick any promising recording and switch to **Make a song**. Choose a target length budget (1:30, 2:00, or 3:00) and expand the idea into 6–8 sections (Intro, Verses, Choruses, Bridge, Outro).
- **Refine every section**: Edit arrangement notes and sung lyrics section by section before clicking **Generate the song** (duration is a generation budget; the song may finish earlier).

### 3. Recording Shelf, A/B Audition & Lossless Trim Export
- **Non-destructive takes**: Every generated, imported, separated, converted, or locally mixed audio take stays on the right-hand recording shelf with favorites, renaming, and discard controls.
- **Position-matched A/B audition**: Assign **A** and **B** beside any two takes to compare them seamlessly at the current playhead (or from the beginning if the target take is shorter).
- **Waveform playback, trim & export**: Loop selections, audition at 0.75× / 1× / 1.25× speed, and trim waveforms without altering original files (playback speed and volume never affect exported audio). Desktop reveals original or trimmed WAV files in your file manager; Web downloads actual audio or score files directly in the browser.

### 4. ABC / MIDI Scores & Score-Conditioned Generation
- **Import & render**: Import MP3, WAV, or FLAC recordings (up to 10 minutes / 512 MiB) and ABC or MIDI scores (up to 1 MiB) with built-in staff notation rendering.
- **Edit melodies & preview**: Derive an editable melody copy to edit pitches, beat timing, chords, tempo, and key on the melody roll, audition before/after changes with the built-in local synthesizer, and review explicit conversion losses.
- **Generate from score**: When your configured `music.generate` route supports score conditioning, select any saved score as the input for your next music generation.

### 5. Audio Lab
- **Find the score in a recording (`music.transcribe`)**: Extract an editable ABC score sketch from a recording or time range (notes and chords are model estimates; review against the original audio).
- **Separate vocals and background (`audio.separate`)**: Split a recording or range into vocal and backing stems (plus drums, bass, and other stems when supported by your selected implementation) while keeping the source intact.
- **Voice conversion (`audio.voice.convert`)**: Pick a source vocal, a separate project recording as the target voice reference, and an accompaniment track to keep (with optional semitone shift). Overtone renders the converted vocal and mixes it locally with the kept accompaniment without modifying existing recordings.

---

## Primary PC & Model Configuration

Prepare your local models or cloud connectors in Nimi Home on your primary PC, then bind capabilities inside Overtone's **AI settings**:
- **`text.generate` (for direction exploration & song arrangement)**: Generates three musical directions, section plans, and lyric drafts (manual writing does not require text generation).
- **`music.generate` (for audio rendering)**: Renders sketches, full songs, and score-conditioned tracks.
- **`music.transcribe` (optional)**: Estimates editable ABC scores from saved recordings.
- **`audio.separate` (optional)**: Separates recordings into vocals, background, and supported instrument stems.
- **`audio.voice.convert` (optional)**: Converts a vocal track using another project recording as a voice reference.

---

## Data Handling, Recovery & Current Limitations

- **Protected Storage & Routing**: Saved projects, scores, and audio assets live in protected Nimi App storage scoped to your account and Overtone on your primary PC. Each project document has a 16 MiB budget (audio and score asset bytes are stored separately). Browser Local Storage holds only non-secret UI preferences (language, light/dark scheme, and volume) and may persist after uninstall. On the local Android preview build, local playback and explicit system sharing stage temporary copies inside Android app cache (`overtone-media` / `overtone-exports`); after a successful share handoff, the staged cache copy may remain until Android evicts cache and the receiving app may save its own copy, while canonical files remain in protected Runtime storage on your primary PC. When you choose a Cloud route for a capability, the text or audio needed for that request is sent to your chosen provider; Local routes process on your primary PC.
- **Unfinished Job Recovery**: Music generation, transcription, and voice conversion record a submission identity before running, and stem separation records its captured `jobId`. Reopening or reconnecting lets you check original jobs and save completed results without re-running the model, subject to Runtime and provider retention windows.
- **Storage Cleanup**: **Clean up storage** in Preferences requires explicit confirmation to permanently delete superseded explorations and unreferenced files while protecting the active project, in-flight tasks, pending recovery entries, and explicit exports.
- **Current Limitations**: General reference-audio remixing, audio continuation, multi-track DAW mixing, and Realm publishing are not supported. Transcription, timbre conversion, and full-song timing are model estimates rather than guaranteed reproductions. Avoid editing the same project concurrently from multiple clients, as concurrent edits are not auto-merged.

---

## Help & Feedback

If you encounter setup, connection, or playback issues, first check that Nimi Home and Runtime are running on your primary PC and review your bindings in **AI settings**. You can report issues or read engineering documentation on [GitHub](https://github.com/nimiplatform/nimiapp-overtone) or open an issue at [GitHub Issues](https://github.com/nimiplatform/nimiapp-overtone/issues).
