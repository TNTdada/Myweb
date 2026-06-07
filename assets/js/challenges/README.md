# Challenge Logic Modules

These modules are intentionally independent from the current game UI.

- `rng.js`: deterministic seeded random helpers.
- `mapShapes.js`: active-cell map generation, non-rectangular shapes, connectivity checks, minefield generation.
- `modes.js`: Microsoft Minesweeper-inspired challenge mode rule state.
- `dailyGenerator.js`: deterministic five-challenge daily set generation.

The next integration step is to adapt `game.js` to consume these modules through a `challenge` query parameter and a Supabase-loaded challenge config.

Generate database rows with:

```powershell
node scripts\generateDailyChallengeSql.mjs --from 2026-06-07 --days 31 --today 2026-06-07
```

Paste the output into Supabase SQL Editor to upsert daily challenge configs.
