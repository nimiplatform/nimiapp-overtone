# AGENTS.md
- Treat `.nimi/app-scaffold/intent.json` and `.nimi/app-scaffold/lock.json` as app-scaffold intent and lock state.
- Treat `.nimi/{config,contracts,methodology}/**` as `@nimiplatform/nimi-coding` managed projections created by `pnpm run init`. Do not hand-edit.
- Treat `.nimi/spec/**` as the active normative product authority for Nimi Overtone. Read `.nimi/spec/INDEX.md` before product or capability edits.
- Keep auth, Runtime, permission, manifest, and Tauri shell glue in scaffold-managed files (`src/shell/auth/**`, `src/shell/App.tsx`, `src/shell/authenticated-shell.tsx`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`).
- The app-owned area is `src/shell/routes/product-area.tsx`, `src/overtone/**`, app-owned Overtone contract tests under `test/**`, and any future app-owned Tauri modules under `src-tauri/src/`.
- `.nimi/admission/**` and `ADMISSION.md` are developer-submitted review inputs, not platform admission truth.
- Local checks are pre-submission self-checks only.
