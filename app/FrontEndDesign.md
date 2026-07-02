# Front-End Design Reference

Quick reference for the visual language used across `app/src/components`. Keep new screens consistent with this rather than inventing new colors/spacing ad hoc.

## Palette (dark theme only, see `src/index.css`)

| Role | Color | Used for |
|---|---|---|
| App background | `#0d0d0d` | `<body>` |
| Surface | `#181818` / `#1a1a1a` | cards, list items, panels |
| Surface (raised/hover) | `#1c2a3e` | selected/hovered cards, roster chips |
| Border | `#333` | default card/panel borders |
| Border (accent) | `#8ab4f8` | selected state, hover state |
| Text (primary) | `#e8e8e8` / `#eee` | body text |
| Text (muted) | `#888` / `#999` / `#aaa` | secondary text, hints, situation labels |
| Win | `#4caf50` (border/bg `#1a2e1a`) | touchdown, win banner, progress fill |
| Loss | `#ef9a9a` (border/bg `#2e1a1a`) | turnover, loss banner |
| Tier: star | `#ffd54f` | player card tier label |
| Tier: starter | `#80cbc4` | player card tier label |
| Tier: scrub | `#ef9a9a` | player card tier label |

## Typography

- Font: system-ui stack (`src/index.css`), no custom webfonts.
- `h1`: 2rem, page titles ("Draft Your Roster", "The Final Drive").
- `h2`: 1.4rem, section/banner headers.
- Body: 1rem default; `.hint`/muted text drops to ~0.75–0.85rem.

## Spacing

- Section/component gaps: 0.5–0.75rem for tightly related items (cards in a list), 1.25–1.5rem between distinct sections.
- Card padding: 0.5–0.85rem depending on density (player cards are denser than play-feed entries).
- Border radius: 6–8px on every card/button/input — keep this consistent, it's the one rounding value used throughout.

## Key components and their files

- **Player cards / draft grid**: `src/components/draft/draft.css` — compact cards, tier-colored label, flavor text.
- **Field visualizer**: `src/components/drive/DriveFieldVisualizer.tsx` + `drive.css` (`.field-track`/`.field-progress`/`.field-endzone`) — the single most prominent visual element on the drive screen, sized deliberately large (see below) since it's the player's primary read of game state.
- **Play-by-play feed**: `src/components/drive/PlayByPlayFeed.tsx` — chronological list, touchdown/turnover rows get distinct border+background per the win/loss colors above.
- **Play-call buttons**: `src/components/drive/PlayOptionButtons.tsx` — full-width stacked buttons, not a grid; this is a deliberate choice so labels (which can be long, e.g. "Deep pass to Christian McCaffrey") never truncate.
- **Result banner**: `src/components/result/result.css` — reuses the win/loss color pair above.

## Field visualizer sizing

The field bar is intentionally the largest single graphical element on the drive/result screens (taller bar, larger end-zone labels, visible yard-line ticks) since it's the at-a-glance summary of "how far do I have to go" — don't shrink it back down to a thin progress-bar-style strip.
