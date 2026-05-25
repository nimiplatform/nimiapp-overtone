# Overtone IA Contract

Rule family: `OVT-IA-*`. Information architecture and admitted shell
zones for the Overtone workspace.

## OVT-IA-01 — Three-zone workspace layout

The authenticated workspace MUST render exactly three primary zones:

1. **Compose** (left column) — brief, lyrics, generation controls,
   iteration controls.
2. **Output** (right column) — take list with selection and A/B
   comparison.
3. **Transport** (footer) — playback controls and waveform for the
   selected take.

A renderer that introduces a fourth primary zone (sidebar projects,
chat sidebar, dataset console, agent panel) is a contract violation.

## OVT-IA-02 — Empty state

Before the user starts a project, the workspace MUST render an
empty-state surface with:

- App identity (`Overtone`).
- A single primary CTA (`Start New Session`).
- A typed readiness indicator showing runtime / realm / music / text
  status.

Hiding the readiness indicator behind a settings dialog is a contract
violation; readiness must be visible at workspace entry.

## OVT-IA-03 — Stage panels

The Compose column MUST present its stage panels in the order admitted
by `OVT-FLOW-02`:

1. Song Brief panel.
2. Lyrics panel.
3. Generation Controls panel.
4. Iteration panel (rendered only after at least one take exists).

Stage panels MAY be presented as accordion sections or a vertical
scroll; horizontal tab navigation is forbidden in this column.

## OVT-IA-04 — Take list

The Output column MUST render takes in reverse chronological order
(newest first). Each take entry MUST display:

- Title (editable).
- `origin` badge.
- A mini waveform projection of the artifact (if decoded).
- Selection affordance bound to `selectedTakeId`.
- Favorite / discard affordances.
- A/B compare slot affordances.

## OVT-IA-05 — A/B compare overlay

When both `comparedTakeIds` slots are populated, the Output column MAY
render an A/B overlay surface. The overlay MUST NOT remove or hide the
underlying take list; the user must be able to dismiss compare without
losing state.

## OVT-IA-06 — Transport

The Transport zone MUST render:

- Play / pause control bound to the selected take's decoded buffer.
- Current time / duration in `m:ss / m:ss` form.
- A clickable waveform that seeks within the selected take.

Trim controls (set in / set out / clear) are admitted as P0 affordances
adjacent to the waveform; advanced multi-region trims are out of scope.

## OVT-IA-07 — Publish modal

Realm publish MUST open as a modal dialog surface rendered through
`@nimiplatform/kit/ui#OverlayShell`. The publish modal MUST contain:

- Take preview with title + origin badge.
- Editable title, description, tags.
- Provenance confirmation checkbox.
- Typed status surface for upload / create / done / error states.
- Cancel + Publish primary controls.

A renderer that publishes from an inline panel or a navigation route is
a contract violation.

## OVT-IA-08 — Navigation primitives

The Overtone workspace MUST NOT introduce:

- Tab bars, breadcrumb trails, or multi-page navigation.
- Project picker dropdowns.
- Persistent left rails listing past sessions, prior projects, or
  external dataset consoles.

A single in-workspace `Close Project` affordance is admitted for the
project reset path (`OVT-FLOW-11`).

## OVT-IA-09 — Readiness banners

When `ReadinessSnapshot` reports `degraded` runtime or unconfigured
realm, the workspace MUST render a typed readiness banner above the
Output column. Banners MUST link to the action that resolves the gap
(connector setup, auth retry) or carry a typed `actionHint`.

## OVT-IA-10 — Keyboard affordances

Admitted keyboard affordances:

- `Space` toggles playback for the selected take.
- `← / →` seek by 5 seconds; `Shift+← / Shift+→` seek by 15 seconds.
- `Esc` closes the publish modal or exits compare mode (whichever is
  active).
- `⌘N / Ctrl+N` resets the project and starts a new session.

A renderer that wires any of these keys to a different action is a
contract violation.
