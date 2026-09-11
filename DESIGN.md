---
name: Overtone
description: A living graphic score for playful musical exploration.
colors:
  paper: "#f5f5f0"
  surface: "#fff"
  ink: "#242621"
  muted: "#62665c"
  line: "#dddfd5"
  blue: "#3546df"
  blue-soft: "#e9edff"
  lime: "#ddf594"
  selected: "#edf0e7"
  paper-dark: "#171b18"
  surface-dark: "#202521"
  ink-dark: "#f2f3ec"
  muted-dark: "#afb7aa"
  line-dark: "#383f37"
  blue-dark: "#4255ed"
  blue-soft-dark: "#303b51"
  selected-dark: "#2e372b"
  transport: "#242922"
  transport-text: "#f6f8ef"
  transport-muted: "#d5dccd"
typography:
  display:
    fontFamily: '"Overtone Display", var(--nimi-font-sans)'
    fontSize: 27px
    fontWeight: 400
    letterSpacing: -0.035em
  headline:
    fontFamily: var(--nimi-font-sans)
    fontSize: 29px
    fontWeight: 750
    letterSpacing: -0.035em
  title:
    fontFamily: var(--nimi-font-sans)
    fontSize: 18px
    fontWeight: 700
    letterSpacing: -0.02em
  body:
    fontFamily: var(--nimi-font-sans)
    fontSize: 12px
    lineHeight: 1.8
  prompt:
    fontFamily: var(--nimi-font-sans)
    fontSize: 17px
    lineHeight: 1.6
  label:
    fontFamily: var(--nimi-font-sans)
    fontSize: 11px
  coordinate:
    fontFamily: var(--nimi-font-mono)
    fontSize: 10px
rounded:
  tag: 3px
  control: 8px
  action: 9px
  selection: 10px
  notebook: 12px
  field: 14px
  circle: 50%
spacing:
  tight: 8px
  compact: 12px
  section: 24px
  stage: 30px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-secondary-transport:
    backgroundColor: "#394031"
    textColor: "{colors.transport-text}"
  prompt-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.prompt}"
    rounded: "{rounded.field}"
  direction-choice:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.selection}"
    padding: 14px 12px
  detail-tag:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    padding: 3px 7px
  notebook:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.notebook}"
    padding: "{spacing.section}"
  intent-field:
    backgroundColor: "{colors.blue}"
    textColor: "#f7f8ff"
    rounded: "{rounded.field}"
---

# Design System: Overtone

## Overview

**Creative North Star: "The living score"**

Musical exploration feels like a playable graphic score: off-white working surfaces, ink lettering, a saturated ultramarine intent field, and a lime marker. Flat planes and deliberate spacing support a curious, direct instrument. The Archivo Black wordmark gives it a compact, forceful signature.

This records the implemented visual system. Product authority remains under `.nimi/spec`; Kit continues to supply protected control, focus, overlay, and accessibility behavior. The approved redesign replaces the former copper/glass identity.

**Key Characteristics:**

- Flat working planes with precise dividers.
- Ultramarine for the intent field; lime for the movable marker and listening controls.
- Compact labels around generous creative content.
- Code geometry for intent; decoded audio for recording waveforms.

## Colors

The palette joins quiet paper and ink with a concentrated ultramarine field and lime interaction markers. Frontmatter values describe the light scheme; the dark-suffixed tokens are the corresponding CSS overrides.

- **Primary — Ultramarine:** the playable intent field, brand symbol, focus, and comparison selection. Blue-soft supports active surfaces.
- **Secondary — Lime:** the intent marker, the focused interpretation's letter, and the main listening control. It also becomes the primary action fill in dark mode.
- **Neutral — Paper, Surface, Ink, Muted, Line, Selected:** canvas, working planes, text hierarchy, separators, and selected recording rows. Light primary actions use ink with white text.
- **Listening strip:** fixed dark transport colors in both schemes; its secondary text remains readable against that background.

## Typography

**Display:** the bundled, licensed Archivo Black file is registered as Overtone Display; reserve it for the wordmark. Body and controls inherit Kit's --nimi-font-sans; score coordinates use --nimi-font-mono.

The headline is strong sans type, followed by compact section titles and helper text. The prompt is the larger reading/entry role. Direction titles and genre lines wrap; elapsed time uses tabular numerals. On small screens the wordmark becomes 24px, the main heading 25px, and prompt text 15px.

## Layout

The desktop workspace pairs a flexible creation area with a 330px recordings shelf beneath a 68px masthead. The creation area uses 28px 30px 22px padding and 24px section gaps. A named generation strip and full-width transport remain adjacent to the work.

At 1500px the shelf grows to 360px; at 1200px it narrows to 294px. At 920px the creation and recording regions stack inside one content scroller; the transport occupies its own layout row so it cannot cover keyboard focus. At 580px the score/index and notebook become single-column, main actions fill their row, and outer content padding becomes 16px. These are the current workspace's responsive measurements, not a template for unrelated screens.

## Elevation & Depth

Working surfaces and buttons are flat. Dividers, tonal fills, and the dark listening strip establish hierarchy. Only floating preferences/suggestion menus and the movable intent marker use local shadows; their exact values live in the sidecar. Preserve Kit overlay behavior without adding ambient glass to the workspace.

## Shapes

Rounded fields and small control corners soften crisp planar regions. Circular geometry identifies the wordmark, interpretation letters, play controls, and movable marker. The score uses generated line geometry; recording rows carry real audio waveforms. No raster illustration is required by this system.

## Components

- **Actions:** primary Explore/Apply/Generate uses Kit's primary tone with a flat local shape. The generation strip shows one next action for the current state. The prominent generation button has a minimum height of 46px and width of 160px; ghost tools stay quiet. Secondary controls retain Kit tokens, with an explicit dark variant inside the transport.
- **Idea input:** a bordered surface with a blue focus-within edge, a resizable textarea, and an integrated tool row. Notes and lyrics use Kit fields inside the notebook.
- **Interpretation index:** a compact pressed-state choice group. The focused row reverses to ink/surface and gains a lime letter marker; genre text remains legible. This is local selection, not route navigation.
- **Tags and notebook:** small muted descriptor tags and one flat bordered notes container. Tags are labels, not buttons.
- **Intent field:** ultramarine plane, procedural lines, crosshair, coordinate label, and lime control point. Pointer movement, arrow keys, and labeled sliders express the same intent. Its graphic is separate from decoded sound.
- **Recordings and transport:** stable waveform rows, direct A/B assignment, and a dark listening strip. Selection uses a tonal fill; playback state belongs to the existing product behavior.
- **Motion:** the waiting dot pulses; a changed interpretation enters briefly. Both local animations stop under reduced motion. Representative sidecar previews illustrate appearance only and do not execute product workflows.

## Do's and Don'ts

- Do use the current light/dark role tokens and keep Kit behavior intact.
- Do distinguish a focused interpretation, an applied direction, and a recording.
- Do keep labels readable and allow English and Chinese content to wrap.
- Do retain pointer, keyboard, and range-input access to the intent controls.

- Don't restore the replaced copper/glass identity or add ambient card shadows.
- Don't present the procedural score as an audio waveform or a generated recording.
- Don't repeat the Apply action beside the interpretation detail; the generation strip owns that next action.

## Recoverable music results

Pending imports use the existing blue-soft plane and ordinary body text in the recordings shelf. Recover audio uses the primary action; generating the same draft again becomes secondary while its result is recoverable. Warning text uses the existing ink role in both themes, retaining Kit warning backgrounds and behavior. Playback and compact waveforms share renderer-cached media; this adds no visual identity or raster assets.

## Workspace resilience

A failed local draft write appears below the masthead with a retry action; the notice does not obscure content or promise persistence before the write succeeds. Comparison controls show a stable list recording number below a wrapping title. Transport trim labels use the transport-muted color and remain grouped with their matching controls. Current song versions return to the existing arrangement; starting from another recording is named explicitly.
