# WORMROUTE — Data Worm Tunnel Navigation

A standalone snake-style hacking minigame with a 90s phosphor-green CRT
theme. Pilot the data-worm out of the circular staging room, then climb a
winding 5-cell-wide conduit up to the exfil node. **Touch a wall and the
worm splatters.**

No backend, no build step, no dependencies, and no network calls — just
open `index.html` in a browser and the game starts immediately. Run it
fully offline from a file, a USB stick, or any static host.

## Files

```
├── index.html   → the whole game page (boots itself on load)
├── game.js      → engine, 10 maps, audio, win/fail flow
├── style.css    → phosphor CRT theme
└── README.md    → this file
```

## How to play

- **Arrows / WASD** — steer the worm.
- Climb out of the staging room into the 5-wide conduit above.
- Reach the amber **EXFIL** pad at the top of the tunnel. Don't touch the walls.

## The 10 sectors

Winning a sector auto-advances to the next. Progress is saved in
`localStorage`, so reopening the page resumes at the sector you reached.
Clearing all 10 shows the **NETWORK BREACHED** victory screen.

| # | Sector | Tunnel | Notes |
|---|----------------|--------|-----------------------------------|
| 1 | FIRST LINK | 72 | slowest, gentle meander |
| 2 | OPEN CONDUIT | 80 | |
| 3 | LONG HAUL | 88 | |
| 4 | SWITCHBACK | 92 | longer worm (6) |
| 5 | DEEP CLIMB | 96 | |
| 6 | NARROW MIND | 96 | wilder sweep |
| 7 | SERPENT RUN | 100 | faster, worm 7 |
| 8 | THE COIL | 104 | |
| 9 | VERTIGO | 108 | worm 8 |
| 10 | TERMINAL VELOCITY | 112 | fastest, longest, windiest |

## Tweaking

- Maps live in the `MAPS` array at the top of `game.js` — each entry sets
  the tunnel length (`len`), meander amplitude/waves/phase (`amp`, `waves`,
  `phase`), step speed (`ms`, lower = faster) and worm length (`wormLen`).
- The palette is driven by the CSS variables at the top of `style.css`.
