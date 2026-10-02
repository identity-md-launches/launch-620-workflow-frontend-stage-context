# Swarm Spark — implemented design

## Overview

A community hackathon site for builders choosing an experimental tool, registering a working demo and following other projects. The visual character is quiet and practical: warm paper, dark ink, a lime primary action, generous section spacing and a simple custom spark. There is no official IMD branding. The editorial hero belongs to this landing page; it is not a required layout for every future surface.

The single-page hierarchy is experiment notice → identity/navigation → theme and live countdown → entry instructions/form → projects → toolkit → judging/prizes/eligibility → FAQ → deployment details. Source is `src/App.tsx`; the transaction workspace is `src/EntryForm.tsx`. Shared styling and canonical design values are in `src/styles.css`.

This file lives under `web/` because the assignment’s explicit path budget prohibits creating root `DESIGN.md`.

## Colors

The source uses a two-level hex palette: components consume semantic tokens that refer to neutral/lime/status primitives. One light theme is implemented; the countdown and footer use intentional dark surfaces within that theme.

| Semantic token | Final value | Role |
| --- | --- | --- |
| `--page` | `#f6f5ee` | Warm page background |
| `--surface` | `#fffef9` | Forms, toolkit/project cards and modal |
| `--subtle` | `#eeeee5` | Banner, project/rules bands, hints |
| `--ink` | `#21251e` | Primary text, footer/countdown backgrounds |
| `--muted` | `#5c6253` | Supporting copy |
| `--line` | `#d3d5c8` | Structural borders; secondary text on dark surfaces |
| `--control-line` | `#767c6c` | Input edges and noticeable notice borders |
| `--accent` / `--accent-hover` | `#dfef6b` / `#d0e34f` | Primary action fill and hover |
| `--success` | `#365d32` | Registered/verified status, always paired with text |
| `--danger` / `--error-bg` | `#a23022` / `#fff0e9` | Errors and destructive confirmation |
| `--focus` | `#455bca` | 3px keyboard focus outline, 4px offset |

The decorative spark and countdown’s open-state label also use lime; they are not controls. Underlines, button boundaries and link placement identify interactions independently of color. Rendered contrast measurements are in `docs/frontend/interaction-results.json`: body/page 14.25:1, muted/surface 6.25:1, banner copy/subtle 5.41:1, ink/primary fill 12.39:1, error/error background 6.34:1 and footer copy/dark surface 10.48:1. These measurements apply to the named solid rendered pairs, not every possible state.

## Typography

- Body: `Arial`, `Helvetica Neue`, sans-serif, normal 400 and emphasis 600/700. Fonts are system fonts; no font downloads are required. Platform fallback shapes can differ. `font-synthesis: none` is set; no italic design role is required.
- Technical labels, byte counts, IDs and deployment data: `SFMono-Regular`, Consolas, `Liberation Mono`, monospace. Arbitrary addresses and long strings use wrapping rather than losing content to ellipsis.
- Body token `--text-body: 1rem`, label `--text-label: .875rem`, small `--text-small: .8125rem`, component heading `--text-heading: 1.25rem`. Inputs stay 1rem. Secondary hints use .75rem, compact numerical annotations/badges .6875rem, and the art note/tool build annotation .625rem.
- Hero: `clamp(3.5rem, 6.4vw, 5.6rem)`, line-height 1.02, weight 600, letter-spacing -.065em. At 800px and below it uses `clamp(3.5rem, 10vw, 5rem)`.
- Section headings: `clamp(2.1rem, 3.5vw, 3.2rem)`, line-height 1.12, weight 600, tracking -.045em. Component headings use line-height 1.35. Body line-height is 1.55; hero introduction is 1.65.
- Headings use balanced wrapping, descriptions use pretty wrapping, and prose measures range from 43ch in the hero to 74ch in rules. Countdown values use tabular numbers, with units separate from values. The timer is not a per-second live announcement.

## Layout

`.shell` provides shared alignment with a 1200px maximum and 96px total outer margin. At 1100px the margin becomes 64px; at 800px it becomes 40px. Full-width background bands contain a shell. Sections use 96px vertical padding, reduced to 64px at 800px. Spacing tokens define .5, 1, 1.5, 2 and 3rem steps, with larger editorial gaps of 40–100px specified for grids.

The desktop hero uses two columns (1.16fr/1fr); entry instructions and form use .92fr/1.08fr; judging/prizes use 1.05fr/.95fr. Toolkit cards have three columns, project cards three (two below 1100px). At 800px the major pairs stack, navigation becomes a full-width second row, facts become a two-column grid and toolkit/project cards use two columns. At 480px cards, filters and toolkit choices become one column; the wallet action becomes more compact. Desktop toolkit choices are two columns except the 801–1100px form, where available column width requires one.

At 1440, 800, 390 and 320 CSS pixels there was no document horizontal overflow. The 320px form, full-width control inset and paragraph wraps were inspected in screenshots. A 200% root-font enlargement at 1440px also reflowed; this is distinct from native browser zoom. The site is English-only; translated/RTL layouts have not been verified.

## Elevation & Depth

The page is primarily flat. Borders communicate groups or controls, with alternating warm surfaces for separation. The countdown is dark rather than elevated. Only the native confirmation dialog casts a shadow (`0 12px 60px #0003`) over a `#21251e99` backdrop. The skip link is fixed at z-index 20 and clipped while inactive; it appears with keyboard focus. The header is in normal flow, so it does not cover hash destinations.

## Shapes

Controls have 5–6px radii; cards/notes use 8px, and major panels/dialog use 12px. Pills are reserved for compact status text. Step numbers are 36px circles. The `Spark` component is an original inline SVG, decorative and hidden from assistive technology. Its large hero variant sits within two static CSS ellipses. No raster artwork, autoplay, background video or animation library is used.

## Components

| Pattern/source | Use and behavior |
| --- | --- |
| `.button`, `src/styles.css` | Outlined secondary action; `.primary` lime action; `.compact` 44px minimum; default 50px minimum; `.wide` panel action; `.destructive` red confirmation. Disabled actions have native semantics and an explanatory nearby state. |
| `Spark`, `External`, `EntryCard`, `src/App.tsx` | Decorative mark, named external link with `noopener noreferrer`, safe project card with full address, toolkit labels and explicit withdrawal status. Unsafe metadata URLs remain text. |
| `EntryForm`, `src/EntryForm.tsx` | Controlled draft, UTF-8 counters, labels and described errors; focuses first invalid field. Checkbox labels include the hit area. Wallet/account change resets the workspace; polling does not overwrite an active draft. |
| Native `dialog`, `src/EntryForm.tsx` | Permanent-withdrawal confirmation. Background becomes inert through `showModal()`, “Keep entry” receives initial focus, Escape closes, and focus returns to the trigger. |
| `.registry-health`, `src/App.tsx` | Persistent read status, block/count, refresh action, error/retry state; never represents missing data as an empty registry. |
| Search and status controls, `src/App.tsx` | Native inputs/select; page-scoped entry search, toolkit search, clear-filter recovery. Pagination announces page numbers and disables unavailable directions. |
| Native `details`/`summary`, `src/App.tsx` | FAQ, prize custody and technical disclosures. Keyboard activation and disclosure state are provided by the browser. |
| Banner, `src/App.tsx` | The experiment/AI/prize-risk statement stays in the document across all hash destinations. Unofficial status appears in hero, FAQ and footer. |

Visible keyboard focus uses the shared outline; forced-colors mode uses `Highlight`. Button color/press transitions are 120ms and only enabled for `prefers-reduced-motion: no-preference`; press scale is .96. No entrance animation or smooth scrolling is imposed. Transaction results use persistent status/alert regions and explorer links, not disappearing toasts.

## Do’s and Don’ts

- Start a new section with `.section` and `.shell`, a numbered eyebrow, one `h2`, and an existing grid pattern. Keep content in document order when stacking.
- Use semantic color tokens. Keep registration as the primary action in its workspace; use outlined controls for peers and red only for an explicit destructive step.
- Preserve the banner, unofficial identity, accessible labels and the distinction between confirmed, pending and failed chain operations.
- Use `safeUrl` and text rendering for community metadata. Do not add HTML injection, iframe previews or automatic fetching of untrusted project URLs.
- Load contracts/network/ABIs from the deployment manifest. Do not introduce a second frontend address map or a HACK requirement.
- Keep any added navigation as in-page/hash navigation unless additional static entrypoints are exported. Every exported change requires a fresh manifest build.

Design guidance attribution and licenses are retained in `docs/frontend/DESIGN-NOTICE.txt` and `DESIGN-LICENSE.txt`; review coverage and limitations are in `docs/frontend/VALIDATION.md`.
