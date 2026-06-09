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
  assert.equal(challenge.shapeType, SHAPE_TYPES.RECTANGLE);
  assert.equal(typeof challenge.xpReward, "number");
}

const rectangle = createMinefield({
  rows: 14,
  cols: 14,
  mines: 24,
  shapeType: SHAPE_TYPES.RECTANGLE
}, createRng("rectangle-test"));
assert.equal(isConnected(rectangle.activeCells), true);
assert.equal(rectangle.activeCells.length, 14 * 14);

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
assert.equal(flags.movesUsed, 0);
assert.equal(flags.status, "playing");
flags = applyModeAction({
  mode: GAME_MODES.FLAGS,
  targetCount: 2,
  moveLimit: 2
}, flags, { type: "flag", isMine: true });
assert.equal(flags.movesUsed, 0);
assert.equal(flags.status, "playing");
flags = applyModeAction({
  mode: GAME_MODES.FLAGS,
  targetCount: 2,
  moveLimit: 2
}, flags, { type: "flag", isMine: true });
assert.equal(flags.status, "playing");
flags = applyModeAction({
  mode: GAME_MODES.FLAGS,
  targetCount: 2,
  moveLimit: 2
}, flags, { type: "flag", correctFlags: 2, wrongFlags: 0 });
assert.equal(flags.status, "won");

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

let tapsLives = createModeState({
  mode: GAME_MODES.TAPS,
  lives: 1
});
tapsLives = applyModeAction({
  mode: GAME_MODES.TAPS,
  targetCount: 3,
  mineMistakeLimit: 99,
  lives: 1
}, tapsLives, { type: "reveal", isMine: true });
assert.equal(tapsLives.status, "failed");
assert.equal(tapsLives.reason, "生命值已耗尽");

console.log("challenge module tests passed");
