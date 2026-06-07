import { createRng, pickOne, randomInt, shuffle } from "./rng.js";
import { SHAPE_TYPES } from "./mapShapes.js";
import { GAME_MODES } from "./modes.js";

export const DIFFICULTY_TIERS = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard"
};

const MODE_ORDER = [
  GAME_MODES.CLASSIC,
  GAME_MODES.TAPS,
  GAME_MODES.TREASURE_HUNT,
  GAME_MODES.DETONATION,
  GAME_MODES.FLAGS
];

const TIER_POOL = [
  DIFFICULTY_TIERS.EASY,
  DIFFICULTY_TIERS.EASY,
  DIFFICULTY_TIERS.MEDIUM,
  DIFFICULTY_TIERS.MEDIUM,
  DIFFICULTY_TIERS.HARD
];

const TIER_RANGES = {
  [DIFFICULTY_TIERS.EASY]: {
    rows: [8, 11],
    cols: [8, 12],
    density: [0.12, 0.16],
    moveRatio: [0.45, 0.62]
  },
  [DIFFICULTY_TIERS.MEDIUM]: {
    rows: [12, 16],
    cols: [12, 18],
    density: [0.15, 0.2],
    moveRatio: [0.34, 0.5]
  },
  [DIFFICULTY_TIERS.HARD]: {
    rows: [16, 22],
    cols: [16, 24],
    density: [0.18, 0.24],
    moveRatio: [0.24, 0.4]
  }
};

export function generateDailyChallenges(dateString) {
  const rng = createRng(`daily:${dateString}`);
  const modes = shuffle(rng, MODE_ORDER);
  const tiers = shuffle(rng, TIER_POOL);

  return modes.map((mode, index) => {
    const tier = tiers[index];
    const seed = `${dateString}:${mode}:${tier}:${index + 1}`;
    return createChallengeConfig({
      dateString,
      slotIndex: index + 1,
      mode,
      tier,
      seed
    });
  });
}

export function createChallengeConfig({ dateString, slotIndex, mode, tier, seed }) {
  const rng = createRng(seed);
  const range = TIER_RANGES[tier];
  const rows = randomInt(rng, range.rows[0], range.rows[1]);
  const cols = randomInt(rng, range.cols[0], range.cols[1]);
  const shapeType = chooseShape(rng, tier);
  const density = range.density[0] + rng() * (range.density[1] - range.density[0]);
  const estimatedActiveCells = estimateActiveCells(rows, cols, shapeType);
  const mines = Math.max(5, Math.min(estimatedActiveCells - 9, Math.round(estimatedActiveCells * density)));
  const moveLimit = calculateMoveLimit(rng, mode, tier, estimatedActiveCells, mines, range);
  const targetCount = calculateTargetCount(mode, estimatedActiveCells, mines);
  const mineMistakeLimit = calculateMineMistakeLimit(mode, tier);

  return {
    challengeDate: dateString,
    slotIndex,
    mode,
    difficultyTier: tier,
    rows,
    cols,
    shapeType,
    mines,
    targetCount,
    moveLimit,
    mineMistakeLimit,
    seed
  };
}

function chooseShape(rng, tier) {
  if (tier === DIFFICULTY_TIERS.EASY) {
    return SHAPE_TYPES.RECTANGLE;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return pickOne(rng, [SHAPE_TYPES.RECTANGLE, SHAPE_TYPES.CENTER_HOLE]);
  }
  return pickOne(rng, [SHAPE_TYPES.RECTANGLE, SHAPE_TYPES.CENTER_HOLE, SHAPE_TYPES.CORNER_BLOCKS]);
}

function estimateActiveCells(rows, cols, shapeType) {
  if (shapeType === SHAPE_TYPES.CENTER_HOLE) {
    return Math.round(rows * cols * 0.94);
  }
  if (shapeType === SHAPE_TYPES.CORNER_BLOCKS) {
    return Math.round(rows * cols * 0.72);
  }
  return rows * cols;
}

function calculateTargetCount(mode, activeCells, mines) {
  if (mode === GAME_MODES.DETONATION) {
    return Math.max(3, Math.round(mines * 0.55));
  }
  if (mode === GAME_MODES.FLAGS) {
    return Math.max(3, Math.round(mines * 0.5));
  }
  if (mode === GAME_MODES.TREASURE_HUNT) {
    return 1;
  }
  if (mode === GAME_MODES.TAPS) {
    return Math.round((activeCells - mines) * 0.55);
  }
  return activeCells - mines;
}

function calculateMoveLimit(rng, mode, tier, activeCells, mines, range) {
  if (mode === GAME_MODES.CLASSIC) {
    return null;
  }

  const ratio = range.moveRatio[0] + rng() * (range.moveRatio[1] - range.moveRatio[0]);

  if (mode === GAME_MODES.DETONATION) {
    return Math.max(8, Math.round(mines * 0.55 + activeCells * ratio * 0.22));
  }
  if (mode === GAME_MODES.FLAGS) {
    return Math.max(8, Math.round(mines * 0.5 + activeCells * ratio * 0.18));
  }
  if (mode === GAME_MODES.TREASURE_HUNT) {
    return Math.max(10, Math.round(activeCells * ratio * 0.5));
  }

  return Math.max(12, Math.round(activeCells * ratio));
}

function calculateMineMistakeLimit(mode, tier) {
  if (mode === GAME_MODES.FLAGS || mode === GAME_MODES.DETONATION) {
    return 0;
  }
  if (tier === DIFFICULTY_TIERS.EASY) {
    return 2;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return 1;
  }
  return 0;
}
