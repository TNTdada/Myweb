# Challenge Logic Modules

These modules are intentionally independent from the game UI so they can be tested and reused by the SQL generator.

- `rng.js`: deterministic seeded random helpers.
- `mapShapes.js`: active-cell map generation, connectivity checks, minefield generation.
- `modes.js`: Microsoft Minesweeper-inspired challenge mode rule state.
- `dailyGenerator.js`: deterministic five-challenge daily set generation.

`game.js` contains the browser runtime integration. These smaller modules provide a stable test surface for daily challenge generation and rule evaluation.

Generate database rows with:

```powershell
node scripts\generateDailyChallengeSql.mjs --from 2026-06-07 --days 31 --today 2026-06-07
```

Paste the output into Supabase SQL Editor to upsert daily challenge configs.
