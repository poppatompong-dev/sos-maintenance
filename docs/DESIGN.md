# Design system

Register: **product** (the UI serves the task). Principles: restrained colour, one
Thai type family, semantic status vocabulary, consistent components, motion only
to convey state. No gradient / glassmorphism / side-stripe borders / emoji / KPI-
card wall (spec §UX + doc 02/09).

## Theme
Committed **light** theme — operators monitor status indoors at desktops during
the day; a dark navigation rail focuses attention. Tokens live in
`src/app/globals.css` (`@theme`). Verified contrast (measured in-browser):

| Pair | Ratio | AA |
|---|---|---|
| ink `#16202c` on bg `#eef1f4` | 14.5:1 | ✓ |
| muted `#55636f` on surface | 6.2:1 | ✓ |
| status chip (unknown) ink on tint | 5.5:1 | ✓ |
| brand button white on `#0f766e` | 5.5:1 | ✓ |

## Colour tokens
- **Neutrals:** `bg`, `surface`, `panel`, `border`, `border-strong`, `ink`, `muted`.
- **Navigation layer:** `sidebar` (`#0b1930`), `sidebar-ink`, `sidebar-active`,
  `sidebar-accent` (teal).
- **Brand/primary action:** `brand` `#0f766e`, `brand-strong`.
- **Status** (each has `solid` / `ink` / `tint`): `ready` green · `watch` amber ·
  `down` red · `unknown` slate. Committed brand identity from the spec/prototype;
  text tones darkened to clear AA.

Status is **always** icon + Thai text (never colour alone). Mapping in
`src/lib/readiness-view.tsx`; icons in `src/components/icons.tsx` (one line-icon
family, `currentColor`, 1.75 stroke).

## Type
`IBM Plex Sans Thai` (self-hosted via `next/font`, free/OSS), weights 300–700.
One family carries headings, labels, data and body. Fixed rem scale (product
register), tabular numerals for counts.

## Components
- `StatusBadge` — icon + label chip (sm/md).
- `StatusRail` — continuous panel: proportional bar + four readouts (replaces the
  KPI-card wall; the bar has a descriptive `aria-label`).
- `AppRail` — primary nav: left rail (desktop) / bottom bar (mobile), ≤5 items.
- `PoleTable` — the accessible non-map fallback (semantic table, row headers,
  per-row action with a full accessible name).

## Accessibility
`lang="th"`, semantic landmarks, visible focus (`:focus-visible` brand outline),
`prefers-reduced-motion` honoured, touch targets ≥44px, status conveyed without
colour. Resolves the prototype QA findings (button-name, colour-contrast — doc 09).
