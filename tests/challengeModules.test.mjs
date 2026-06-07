import assert from "node:assert/strict";

import { generateDailyChallenges } from "../assets/js/challenges/dailyGenerator.js";
import { createRng } from "../assets/js/challenges/rng.js";
import { createMinefield, isConnected, SHAPE_TYPES } from "../assets/js/challenges/mapShapes.js";
import { applyModeAction, createModeState, GAME_MODES } from "../assets/js/challenges/modes.js";

const challenges = generateDailyChallenges("2026-06-07");
assert.equal(challenges.length, 5);
assert.equal(new Set(challenges.map((challenge) => challenge.mode)).size, 5);
assert.deepEqual(challenges, generateDailyChallenges("2026-06-07"));

for (const challenge of challenges) {
  const minefield = createMinefield(challenge, createRng(challenge.seed));
  assert.equal(isConnected(minefield.activeCells), true);
  assert.equal(minefield.mineKeys.length, challenge.mines);
  assert.equal(minefield.mineKeys.includes(minefield.startKey), false);
}

const centerHole = createMinefield({
  rows: 14,
  cols: 14,
  mines: 24,
  shapeType: SHAPE_TYPES.CENTER_HOLE
}, createRng("center-hole-test"));
assert.equal(isConnected(centerHole.activeCells), true);
assert.ok(centerHole.activeCells.length < 14 * 14);

let detonation = createModeState({
  mode: GAME_MODES.DETONATION
});
detonation = applyModeAction({
  mode: GAME_MODES.DETONATION,
  targetCount: 2,
  moveLimit: 3
}, detonation, { type: "reveal", isMine: true });
detonation = applyModeAction({
  mode: GAME_MODES.DETONATION,
  targetCount: 2,
  moveLimit: 3
}, detonation, { type: "reveal", isMine: true });
assert.equal(detonation.status, "won");

let flags = createModeState({
  mode: GAME_MODES.FLAGS
});
flags = applyModeAction({
  mode: GAME_MODES.FLAGS,
  targetCount: 2,
  moveLimit: 2
}, flags, { type: "flag", isMine: false });
flags = applyModeAction({
  mode: GAME_MODES.FLAGS,
  targetCount: 2,
  moveLimit: 2
}, flags, { type: "flag", isMine: true });
assert.equal(flags.status, "failed");

let impossibleDetonation = createModeState({
  mode: GAME_MODES.DETONATION
});
impossibleDetonation = applyModeAction({
  mode: GAME_MODES.DETONATION,
  targetCount: 3,
  moveLimit: 3
}, impossibleDetonation, { type: "reveal", isMine: false });
assert.equal(impossibleDetonation.status, "failed");
assert.equal(impossibleDetonation.reason, "剩余步数不足以完成引爆目标");

console.log("challenge module tests passed");
