# Result UGC Design System

Version: 1.0<br>
Status: Canonical<br>
Primary theme: Dark<br>
Product character: Fast, exact, operational, confident

This file is the single source of truth for Result UGC's interface. It combines the strongest ideas from the supplied references into a dark creative command center: flat layered surfaces, compact information density, expressive editorial typography, restrained color, and a proprietary performance-led display face.

## 1. Product expression

Result UGC should feel like an operating system for creative performance—not a generic social media dashboard.

The interface should communicate:

- **Signal over noise:** important metrics and next actions are obvious.
- **Velocity with control:** the product feels fast without feeling reckless.
- **Creative intelligence:** outputs feel considered, not machine-generated.
- **Operational confidence:** status, ownership, and history are always legible.
- **Brand restraint:** one strong accent and one distinctive display font are enough.

## 2. Signature traits

1. Near-black canvas with subtle tonal surface steps.
2. Thin low-contrast dividers instead of floating shadows.
3. Large, regular-weight headings with compressed line height and tight tracking.
4. Result Font used as a short, high-impact performance signal.
5. Acid green reserved for the primary action, live status, and positive progress.
6. Small monospaced labels for dates, metrics, statuses, and system metadata.
7. Compact cards with generous internal logic rather than decorative padding.
8. Pills used for controls and statuses; content containers remain lightly rounded.

## 3. Color system

### Primary dark theme

| Role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | `--color-canvas` | `#101010` | Default page background |
| Deep canvas | `--color-canvas-deep` | `#0e0e0e` | Full-width bands and focused work areas |
| Surface 1 | `--color-surface-1` | `#161616` | Navigation, cards, inputs |
| Surface 2 | `--color-surface-2` | `#191919` | Hovered or selected surfaces |
| Surface 3 | `--color-surface-3` | `#202020` | Elevated controls and modal panels |
| Text primary | `--color-text` | `#ffffff` | Headings and primary content |
| Text soft | `--color-text-soft` | `#f4f4f4` | Long-form text where pure white is too sharp |
| Text muted | `--color-text-muted` | `#999999` | Secondary descriptions and helper text |
| Text faint | `--color-text-faint` | `rgba(255,255,255,.35)` | Metadata and inactive labels |
| Border | `--color-border` | `rgba(255,255,255,.10)` | Default dividers and card outlines |
| Border strong | `--color-border-strong` | `rgba(255,255,255,.16)` | Active grouping and focused boundaries |
| Signal green | `--color-signal` | `#85ed75` | Primary action, live state, success, progress |
| Signal green ink | `--color-signal-ink` | `#101010` | Text and icons on green |
| Alert coral | `--color-alert` | `#fc5f2b` | Errors, destructive confirmation, urgent attention |

### Accent rules

- Green is the only routine accent. Limit it to roughly 5% of any screen.
- Use one filled green primary action per view or task region.
- Coral is semantic, not decorative. It must never compete with the primary action.
- Do not introduce additional chromatic accents for categories; use text, icons, and labels.
- Green text on the dark canvas is appropriate for small status labels, not paragraphs.

### Optional light theme

Light mode is secondary and should be introduced only when a workflow benefits from paper-like review or export.

| Role | Value |
|---|---:|
| Canvas | `#ffffff` |
| Muted surface | `#f4f4f5` |
| Text | `#18181b` |
| Muted text | `#71717a` |
| Border | `#e4e4e7` |

The green and coral semantics remain unchanged. Dark is the product default and the reference state for all new work.

## 4. Typography

### Font families

#### Result Font

Asset: `apps/web/src/assets/Result-Font.woff2`<br>
CSS variable: `--font-result`<br>
Native style: 700 italic<br>
Character: compact, geometric, fast, performance-led

Use Result Font for:

- Result wordmark
- Product marks such as `RESULT UGC`
- Short campaign or performance labels
- Rare high-impact numeric moments
- Branded empty-state or launch moments

Rules:

- Prefer uppercase.
- Keep phrases short: ideally 1–4 words and never more than one line.
- Use letter spacing between `0.02em` and `0.06em`.
- Never synthesize another weight or upright style.
- Never use it for body copy, navigation links, table cells, forms, or long headings.

#### Geist Sans

CSS variable: `--font-geist-sans`<br>
Role: primary UI, body, headings, navigation, buttons

Headings use regular weight with tight tracking. Bold is reserved for small controls, labels, and clear emphasis.

#### Geist Mono

CSS variable: `--font-geist-mono`<br>
Role: metrics, dates, timecodes, statuses, technical labels, identifiers

Use sparingly at small sizes to create an instrumented feel.

### Type scale

| Role | Size | Line height | Tracking | Weight |
|---|---:|---:|---:|---:|
| Display XL | `clamp(64px, 7vw, 112px)` | `.92` | `-.065em` | 400 |
| Display | `66px` | `1` | `-.025em` | 400 |
| Heading XL | `56px` | `1.04` | `-.045em` | 400 |
| Heading L | `45px` | `1.10` | `-.035em` | 400 |
| Heading M | `30px` | `1.16` | `-.025em` | 400 |
| Heading S | `22px` | `1.25` | `-.015em` | 400–500 |
| Body L | `17px` | `1.45` | `-.009em` | 400 |
| Body | `15px` | `1.5` | `-.005em` | 400 |
| Small | `13px` | `1.45` | `-.003em` | 400–500 |
| Caption | `11px` | `1.4` | `0` | 400–600 |
| Micro mono | `9–10px` | `1.2` | `.15–.20em` | 400 |

## 5. Spacing and layout

### Base system

Use a 4px base grid.

| Token | Value |
|---|---:|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-15` | `60px` |
| `--space-19` | `76px` |

### Layout rules

- Maximum content width: `1280px`.
- Desktop page gutters: `32–40px`.
- Mobile page gutters: `20–24px`.
- Major section spacing: `76–128px` depending on density.
- Dashboard card padding: `16–24px`.
- Dense table/list rows: `12–16px` vertically.
- Prefer grid alignment and full-width dividers to disconnected card clouds.
- Keep reading text to `60–70ch`; keep hero support copy below `560px`.

### Breakpoints

| Name | Width | Behavior |
|---|---:|---|
| Mobile | `< 640px` | Single column, simplified navigation, horizontal overflow for data tables |
| Tablet | `640–1023px` | Two-column card grids, condensed side navigation |
| Desktop | `1024–1279px` | Full navigation and multi-column workspace |
| Wide | `>= 1280px` | Fixed content max-width with stable density |

## 6. Shape, border, and elevation

### Radius

| Role | Value |
|---|---:|
| Small cards and controls | `6px` |
| Default cards and inputs | `10px` |
| Navigation and feature panels | `15px` |
| Pills and status chips | `9999px` |

Do not mix many radii within one component family. Cards should feel engineered, not bubbly.

### Borders

- Default: `1px solid rgba(255,255,255,.10)`.
- Strong/active: `1px solid rgba(255,255,255,.16)`.
- Selected green: use a subtle green border or inset ring, not a glow around the whole card.
- Prefer shared dividers inside lists rather than an outline around every row.

### Elevation

The product is primarily flat. Establish depth using surface color and borders.

- Default cards: no shadow.
- Floating navigation: optional backdrop blur and a subtle border.
- Popovers/modal panels: `0 20px 60px rgba(0,0,0,.35)`.
- Green glows are allowed only on tiny live-status dots.

## 7. Core components

### Application navigation

- Dark Surface 1 container with a 15px radius on desktop.
- Result wordmark on the left.
- Navigation links use 12–13px Geist in muted white.
- One green pill action on the right.
- On mobile, navigation may touch the viewport edges and lose its radius.

### Primary button

- Signal green fill, dark ink, full pill radius.
- 12–15px semibold text.
- Include a concise verb and optional arrow.
- No shadow; use contrast and a subtle hover translation.

### Secondary button

- Transparent or Surface 2 fill with a low-contrast border.
- White text; green must not appear unless the action is primary.

### Status chip

- Use a dot plus a short label.
- Live/success: green.
- Neutral/pending: white at 30–45% opacity.
- Error/destructive: coral.
- Do not rely on color alone; always include text.

### Metric card

- Surface 1 or transparent with a border.
- Mono micro-label at top.
- Large Geist numeric value; Result Font may be used only for a singular branded KPI moment.
- Delta and time window remain visually subordinate.

### Data table

- Flat table on the page or within one shared container.
- 12–13px cells with 11px mono column labels.
- 48–56px row height.
- Hairline row dividers; hover changes surface to `#191919`.
- Right-align numeric values and use tabular figures.

### Creative/reference card

- Thumbnail or poster frame on top/left, structured data beside it.
- Always expose source platform, creator, capture date, transcript state, and ownership.
- Use chips for hook, format, angle, and funnel stage—but cap visible chips before wrapping becomes noisy.

### Form input

- Surface 1, 10px radius, one-pixel border.
- Minimum 44px control height.
- White input text, muted placeholder.
- Focus ring: 2px signal green with at least 2px separation.
- Validation errors use coral text and an explicit message.

### Modal and command palette

- Surface 3 with strong border and restrained shadow.
- Focus the first meaningful control.
- Keep high-frequency commands searchable and keyboard-accessible.

## 8. Imagery and media

- The product interface prioritizes real creator videos, thumbnails, transcripts, and performance graphs.
- Avoid decorative stock photography inside the dashboard.
- Use cinematic full-bleed photography only for marketing or onboarding moments.
- Video thumbnails require a dark scrim under overlaid text.
- Preserve source aspect ratio; UGC defaults to 9:16.
- Skeletons should mirror the final content geometry rather than pulse as generic rectangles.

## 9. Data visualization

- Use white/gray for historical series and green for the selected or primary series.
- Coral marks negative exceptions, not ordinary downward movement.
- Gridlines use the default border color.
- Direct-label series where possible; avoid distant legends.
- Tooltips use Surface 3, a strong border, and mono values.
- Every chart must have a readable summary or accessible data table.

## 10. Motion and interaction

- Default transition: `160ms ease-out`.
- Surface and border transitions: `120–180ms`.
- Panels: `200–240ms`, small distance, no spring unless directly manipulated.
- Hover translation is capped at `2px`.
- Avoid looping decorative motion except a subtle live indicator.
- Respect `prefers-reduced-motion` and remove non-essential transforms.

## 11. Accessibility

- Maintain WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text/UI boundaries.
- Keep body text at or above 14px in dense product views and 15px by default.
- All controls require visible keyboard focus.
- Minimum interactive target: 44×44px where practical.
- Never encode status by color alone.
- Provide captions/transcripts for video and text alternatives for meaningful imagery.
- Use semantic headings, landmarks, labels, and table markup before adding ARIA.

## 12. Voice and content

Result's interface voice is direct, calm, and operational.

- Prefer: “Analyze reference”, “Create brief”, “3 posts need review”.
- Avoid: “Unlock magic”, “Revolutionize your content”, or vague AI language.
- Buttons begin with verbs.
- Empty states explain what belongs here and provide one next action.
- Errors state what happened, what remains safe, and how to recover.
- AI output must distinguish source material, inference, and generated recommendation.

## 13. Do and don't

### Do

- Use Result Font as a recognizable signature, not the default typeface.
- Make dark mode the reference state for every new component.
- Use tonal surfaces and hairline dividers to create structure.
- Keep display typography regular-weight, tight, and compact.
- Reserve green for the most important action and live/positive signals.
- Use mono typography to make operational metadata scan quickly.
- Keep component geometry consistent within a workflow.

### Don't

- Do not use Result Font for paragraphs or dense interface content.
- Do not turn every card into a glowing floating panel.
- Do not use heavy shadows or glass effects as decoration.
- Do not add category colors without a semantic need.
- Do not use green and coral as competing calls to action.
- Do not over-round data tables, list rows, and content regions.
- Do not sacrifice legibility for compactness.

## 14. Implementation tokens

```css
:root {
  color-scheme: dark;

  --color-canvas: #101010;
  --color-canvas-deep: #0e0e0e;
  --color-surface-1: #161616;
  --color-surface-2: #191919;
  --color-surface-3: #202020;
  --color-text: #ffffff;
  --color-text-soft: #f4f4f4;
  --color-text-muted: #999999;
  --color-text-faint: rgba(255, 255, 255, 0.35);
  --color-border: rgba(255, 255, 255, 0.10);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-signal: #85ed75;
  --color-signal-ink: #101010;
  --color-alert: #fc5f2b;

  --font-display: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
  --font-brand: var(--font-result), sans-serif;

  --radius-control: 6px;
  --radius-card: 10px;
  --radius-panel: 15px;
  --radius-pill: 9999px;

  --duration-fast: 120ms;
  --duration-default: 160ms;
  --duration-panel: 220ms;
}
```

## 15. Review checklist

Before shipping a screen, verify:

1. There is one clear primary action.
2. Green and coral are being used semantically.
3. Result Font appears only in short branded moments.
4. The information hierarchy still works in grayscale.
5. Every status includes a text label.
6. Keyboard focus is visible and navigation order is logical.
7. Mobile layouts preserve the primary task rather than merely stacking desktop cards.
8. Loading, empty, error, and success states are designed.
9. Data provenance and update time are visible where accuracy matters.
10. The implementation uses this file rather than reinterpreting the original references.
