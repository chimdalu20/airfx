# AirFX — Design System

**Style:** Hyperstudio — *"Blueprint scratched into obsidian."*
**Themes:** light (default) and dark.
Source: [styles.refero.design](https://styles.refero.design/style/8eb9c53e-d69c-497a-b640-610856cf3a60)

## Why this style

AirFX is an **instrument**, not a marketing page. Its whole subject is geometry:
hand landmarks, knob arcs, calibrated ranges, live meters. Hyperstudio's editorial-tech
language — hairline rules carving white space out of near-black, monospace readouts,
authority through scale rather than weight — draws an instrument panel rather than a
dashboard.

It also removes the previous design's biggest weakness: five saturated per-effect accent
colours (`#37e0cf`, `#9b7bff`, `#4f9bff`, `#ffb14e`, `#5fd38a`) plus neon glows on every
dial. That read as gamer-RGB. Hyperstudio's rule — *one* signal colour, reserved strictly
for live state — makes "this effect is armed" the only thing on screen that is coloured,
which is exactly the one thing the user needs to see while their hands are in the air.

Dark is non-negotiable here regardless of style: the UI wraps a live camera feed and is
used in a dim room with headphones. The light options (ElevenLabs, Notion, Superr) would
have fought the video stage.

---

## Palette

The system is one set of semantic tokens with two value sets. Nothing in the sheet
references a raw colour — the theme swap is total.

| Role | Token | Light (default) | Dark |
|---|---|---|---|
| Canvas | `--canvas` | `#f4f4f1` paper | `#101010` obsidian |
| Depth / wells | `--well` | `#ffffff` | `#080808` |
| Primary text | `--ink` | `#101010` | `#f3f3f3` |
| Secondary text | `--ink-2` | `#3d3d3d` | `#c1c1c1` |
| Muted text | `--ink-3` | `#6b6b67` | `#9c9c9c` |
| Hairline borders | `--rule` | `#dededa` | `#212121` |
| Border (hover/strong) | `--rule-2` | `#b4b4ae` | `#474747` |
| Solid action fill | `--action` | `#101010` | `#ffffff` |
| Text on that fill | `--on-action` | `#f4f4f1` | `#101010` |
| Icon strokes only | `--gold` | `#6f6759` | `#8a8072` |
| **Live / active only** | `--pulse` | `#3f7d00` | `#98ff38` |
| Danger | `--danger` | `#b3261e` | `#ff6b64` |

Three tokens deliberately do **not** invert with the theme:

- `--scrim` always *darkens* (`rgba(16,16,16,.58)` light, `rgba(8,8,8,.88)` dark). A scrim's
  job is to dim the page behind a modal; a light scrim over a light canvas washes the whole
  interface out instead of focusing it. `--on-scrim` is near-white in both themes.
- `--badge-fixed` backs the stage tag, which floats over the video feed — arbitrary brightness,
  so it needs its own dark plate in both themes rather than the canvas's.

**Contrast is measured, not eyeballed.** Every text token clears WCAG AA 4.5:1 against its
canvas in both themes (verified in `tests/visual-check.mjs`); `--ink-3` was darkened from
`#767672` to `#6b6b67` because it measured 4.14:1 on paper.

Light is the default. The stored choice wins, and `prefers-color-scheme` is deliberately not
consulted — the default is a product decision, not a system preference. The theme is stamped
on `<html>` by a synchronous inline script in `<head>`, before first paint, so a dark-mode
visitor never sees a white flash.

## Typography

- **Primary:** Inter (the spec's own first fallback for Aeonik, and freely available).
  **Weight 400 for all headings** — authority comes from scale and tracking.
- **Secondary:** IBM Plex Mono for every numeric readout, meter, debug line and knob value.

| Role | Size | Line height | Tracking |
|---|---|---|---|
| caption | 13px | 2.69 | — |
| body | 16px | 1.25 | — |
| heading-xs | 18px | 1.31 | — |
| subheading | 21px | 0.95 | — |
| heading-sm | 23px | 1.07 | — |
| heading | 34px | 1.03 | — |
| heading-lg | 44px | 1.07 | −0.31px |
| display | 63px | 1.05 | −0.69px |

## Shape & spacing

- Base unit **4px**. Scale: 4, 8, 12, 16, 20, 24, 40.
- Radius: tags **4px**, cards **8px**, icons/pills **9999px**. Never exceed 8px on a card.
- Max content width **1200px**. Card padding 32–48px (tightened to 16–20px inside the
  three-column workspace, where density is functional).
- The **1px `--graphite` hairline rule** is the most repeated element in the system. It
  replaces every former shadow and every former glow.

## Components

- **Primary action** (`Start`, `Upload`, `Capture`) — solid white fill, obsidian text,
  pill radius, uppercase, 12px/24px.
- **Secondary** — transparent, 1px white border, 8px radius, 10px/20px.
- **Status badge** — `#1a1a1a` fill, 1px graphite border, 4px radius, Pulse Green dot prefix.
- **Effect card** — transparent, 1px graphite hairline. Inactive dials stroke in `--iron`.
  Armed cards get a white border, a Pulse Green status dot, and their arc strokes in chalk.
- **Section divider** — 1px `--rule`, full content width.
- **Theme toggle** — a ghost button in the header that advertises the *action*, not the state
  ("Dark" when you are in light). Carries `aria-pressed` and a matching `aria-label`.
- **Focus** — a 2px `--pulse` ring with 2px offset on every interactive surface. Effect cards
  are `role="button"`, tabbable, `aria-pressed`, and operable with Enter or Space.

## Rules

**Do**
- Weight 400 on every heading.
- Separate every section with a 1px `#212121` rule.
- Compass Gold **only** for icon strokes (the brand mark, hand-landmark joints, right-hand cursor).
- Pulse Green **only** for live/active state (armed effect, camera live, recording).
- Monospace every number.

**Don't**
- No drop shadows. Anywhere. Elevation is border and contrast only.
- No bold display type.
- No coloured fills behind text.
- No card radius above 8px.
- Don't reintroduce per-effect accent colours.

## Documented deviations

1. **Photography.** The spec says never use photography as content. The webcam feed is a
   functional instrument surface, not content — it stays, framed in a carbon well with a
   graphite hairline.
2. **Density.** Card padding inside the effect racks runs 16–20px rather than 32–48px. A
   five-rack instrument panel at marketing-page padding would not fit a laptop viewport.
3. **Danger colour.** Added, as described above.
4. **Instructional emoji.** The onboarding tour and the calibration guide use hand emoji as
   moving illustrations of the gesture being taught. They are the only saturated colour on
   screen outside Pulse Green, and they are confined to those two transient overlays — the
   instrument panel itself contains none. A line drawing would be more on-style; teaching a
   physical gesture with one would be worse.

## Responsive

Per the project's hard rule, the floor is **375px** with zero horizontal overflow. The three
columns (`left hand` / stage / `right hand`) collapse to a single stacked column below 900px;
the effect racks go two-up below 900px and one-up below 420px. Verified by asserting
`documentElement.scrollWidth <= clientWidth` at 375px.
