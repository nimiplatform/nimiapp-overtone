# AGENTS.md
- Treat `.nimi/methodology/authority-authoring.yaml` as the `@nimiplatform/nimi-coding` managed authoring guide.
- Keep auth, App Access declarations, manifest, and Electron shell glue aligned with the current `@nimiplatform/app-tools` Local App contract.
- Product code lives under `src/overtone/**` and `src/shell/routes/product-area.tsx`; it may consume only the protected `NimiLocalAppClient` surface.
- `.nimi/admission/**` and `ADMISSION.md` are developer-submitted review inputs, not platform admission truth.
- Local checks are pre-submission self-checks only.

## Core Boundary Model

New app code must follow the platform ownership chain:

`Runtime / Realm truth -> @nimiplatform/sdk interface -> app consumer`

The app may compose product UI and app-specific workflows, but it must not create
a second source of truth for platform-owned data, execution state, permissions,
identity, model routing, memory, or admission.

## What Goes Where

### Runtime

Use Runtime for local execution and runtime-owned capability truth:

- AI/model execution, local model catalog, readiness, route selection, warm state, and runtime config.
- Runtime Agent execution, agent turn/session projection, runtime cognition/memory, and future Runtime-owned External Agent action plane.
- Local capability facts that require Runtime authority, validation, audit, or fail-closed semantics.

Do not reimplement Runtime facts in the app with local stores, ad hoc provider/model constants, local HTTP bypasses, or direct private endpoints.

### Realm

Use Realm for cloud canonical business truth:

- Account/profile identity, relationship/social truth, backend-owned entities, cloud persistence, entitlement-like product data, and server-audited state.
- Any data that must be shared across devices, users, or backend workflows.

Do not keep a parallel app-local database that claims to be the canonical copy of Realm-owned data.

### `@nimiplatform/sdk`

Use SDK as the only app-facing interface layer for Runtime and Realm:

- Typed clients, method IDs, request/response schemas, projections, pagination, and platform error/reason-code handling.
- SDK may aggregate typed projections, but it must not become a hidden truth owner.

Do not call Runtime/Realm private REST endpoints directly from app code when a SDK projection exists or should exist.

### `@nimiplatform/kit`

Use Kit for reusable UI and headless product primitives:

- Shared controls, layout primitives, chat/panel/headless composition helpers, accessibility behavior, tokens, and platform-aligned interaction patterns.
- Prefer Kit primitives before creating local components for common platform UI.

Do not fork Kit behavior into app-local copies unless the app has a genuinely product-specific interaction that Kit does not cover.

### Electron Local App shell

Use the Desktop-supervised Electron carrier for local development:

- `pnpm dev` must enter through `nimi-app dev --shell electron`.
- CDP is requested through the official launcher and remains loopback-only.
- The preload exposes only the Kit standard bridge; the main process registers the protected Local App bridge and asset media platform.

Do not launch Electron directly or implement Runtime/Realm authority, grants, admission, model routing, token custody, or generic Runtime transport in the app shell.

### Kit UI Glass Style

Use Nimi Kit UI tokens and glass style for product surfaces unless the app has an admitted product-specific visual system:

- Prefer Kit surfaces, buttons, inputs, overlays, navigation, focus rings, spacing, typography, and glass tokens.
- Keep local CSS limited to app-specific layout and content treatment.

Do not recreate one-off glass cards, shadows, gradients, or control styling when Kit already provides the pattern.

## App-Owned Scope

The app owns product-specific screens, user intent wiring, view-model projection, ephemeral UI state, and product-specific data that is not Runtime-owned or Realm-owned.

Before adding durable local storage, an app-owned Electron command, a private endpoint call, or a platform-like registry, decide and document why the data is app-owned rather than Runtime/Realm-owned.

## Boundary Checklist

- Durable canonical data? Use Realm or Runtime, then consume through SDK.
- Execution/capability/readiness/model/memory truth? Use Runtime through SDK.
- Backend business object or relationship/account truth? Use Realm through SDK.
- Shared UI, layout, chat shell, controls, or glass styling? Use Kit.
- OS helper or native shell action? Use an admitted standard Local App operation or a bounded app-owned Electron command.
- Unsure who owns it? Stop and write an authority note before implementing.

## Forbidden Shortcuts

- No app-level REST bypass around SDK.
- No duplicate auth/session/permission/admission truth.
- No local canonical mirror of Runtime/Realm data.
- No provider/model hardcoding as product truth.
- No compatibility dual-write or pseudo-success state.
- No importing Runtime internals, generated private clients, or Desktop product source.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- From the repository root, invoke the pinned project-local CLI as `pnpm exec nimicoding`; do not probe or rely on a global `nimicoding` binary in `PATH`.
- Product authority lives under `.nimi/spec/**`.
- Choose authority and code queries when their declared scope can resolve an uncertainty that affects the current task; reuse sufficient current evidence. Query scope is not the limit of host reasoning or authorized work, and hypotheses are not product authority.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `pnpm exec nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `pnpm exec nimicoding authority diff` and `pnpm exec nimicoding authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Use `pnpm exec nimicoding authority change-candidates` only with explicit channels and budgets; its complete union is recall input, never conflict, retirement, absence, authority, or conformance judgment.
- When explicit authority links are needed, use `pnpm exec nimicoding code authority --repo <root> --authority <id> --max-files <n> --max-bytes <n>` to locate annotated code, and use `--source <path>` for code-to-authority lookup. Results cover only explicit markers and authority lifecycle; they do not prove implementation conformance or evaluate unannotated code.
- For a new or changed authority-governed feature, add the reserved standalone physical line `// @nimi-authority: <exact-id>` in TypeScript/TSX, Go, or Rust, and `# @nimi-authority: <exact-id>` in Python. The scanner does not prove language comment context, so use this reserved form only for intentional links at a few key semantic owners.
- Use `// @nimi-deprecated: <exact-id>`, or `# @nimi-deprecated: <exact-id>` in Python, only after direct authority evidence or a real product failure confirms obsolete semantics; find it with `pnpm exec nimicoding code authority --repo <root> --audit --max-files <n> --max-bytes <n>` and remove it with the hard cut.
- When a selected TypeScript or TSX consumer still has a static-dependency question, use `pnpm exec nimicoding code context <path> --repo <root> --symbol <identifier> --tsconfig <path> --max-bytes <n>` for bounded root-direct static dependencies; it is not inbound impact, runtime dispatch, or complete task context.
- Use `pnpm exec nimicoding sync --check` to diagnose drift in package-owned managed projections, `pnpm exec nimicoding sync --apply` to restore them, and `pnpm exec nimicoding doctor` to diagnose package/managed compatibility. These commands do not validate product authority, implementation conformance, or task readiness.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `pnpm exec nimicoding authority fmt` on each changed file, then `pnpm exec nimicoding authority check` on the complete authority input set.
- A failed project-local `pnpm exec nimicoding ...` invocation supplies no usable result. Pause decisions that require refused, missing, or incomplete results; continue independent authorized work. Never substitute guessed, corpus-wide, or fallback context, or treat diagnostics or partial output as complete context; choose repair values only from product/task authority.
- Keep derived and local verification output under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->

<!-- nimi-app:managed:start -->
## Nimi App development

- For creating, adapting, upgrading or releasing this App, read [the lifecycle skill](.agents/skills/nimi-app-lifecycle/SKILL.md) and only the relevant scenario.
- Keep App-owned product behavior, Host code, business accounts and non-AI services with this repository. Use the SDK/Kit Local App carrier for Nimi AI, configuration, storage and session access.
- App Tools owns its lifecycle skill, this block, managed workflow and declared engineering fields; preserve other instructions, product source and licenses. Existing adoption does not create fresh scaffold intent or lock.
- Product-operation guides apply to their specific business tasks; they do not replace the Nimi development boundary.
- Reuse the user's confirmed scope and authorization. Report command checks separately from actual App journeys; unrun relevant paths remain NOT-VERIFIED.
<!-- nimi-app:managed:end -->
