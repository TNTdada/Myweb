import { createRng, randomInt, shuffle } from "./rng.js";
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
  const range = rangeForMode(mode, tier);
  const rows = randomInt(rng, range.rows[0], range.rows[1]);
  const cols = randomInt(rng, range.cols[0], range.cols[1]);
  const shapeType = chooseShape(rng, tier);
  const density = range.density[0] + rng() * (range.density[1] - range.density[0]);
  const estimatedActiveCells = estimateActiveCells(rows, cols, shapeType);
  const mines = Math.max(5, Math.min(estimatedActiveCells - 9, Math.round(estimatedActiveCells * density)));
  const moveLimit = calculateMoveLimit(rng, mode, tier, estimatedActiveCells, mines, range);
  const targetCount = calculateTargetCount(mode, estimatedActiveCells, mines);
  const mineMistakeLimit = calculateMineMistakeLimit(mode, tier);
  const lives = calculateLives(mode, tier);
  const xpReward = calculateXpReward(tier);
  const timeLimitEnabled = calculateTimeLimitEnabled(rng, mode, tier);
  const timeLimitSeconds = timeLimitEnabled ? calculateTimeLimit(tier) : null;
  const initialRevealCount = calculateInitialRevealCount(mode, tier);

  return {
    challengeDate: dateString,
    slotIndex,
    mode,
    difficultyTier: tier,
    rows,
    cols,
    shapeType,
    mines,
    mineMin: Math.max(5, mines - Math.ceil(mines * 0.12)),
    mineMax: mines + Math.ceil(mines * 0.12),
    targetCount,
    moveLimit,
    mineMistakeLimit,
    lives,
    xpReward,
    timeLimitEnabled,
    timeLimitSeconds,
    initialRevealCount,
    initialRevealType: mode === GAME_MODES.CLASSIC ? "none" : mode === GAME_MODES.FLAGS ? "mixed_frontier" : "single_area",
    seed
  };
}

function chooseShape(rng, tier) {
  return SHAPE_TYPES.RECTANGLE;
}

function estimateActiveCells(rows, cols, shapeType) {
  return rows * cols;
}

function rangeForMode(mode, tier) {
  const base = TIER_RANGES[tier];
  if (mode !== GAME_MODES.TREASURE_HUNT) {
    return base;
  }

  const densityByTier = {
    [DIFFICULTY_TIERS.EASY]: [0.13, 0.16],
    [DIFFICULTY_TIERS.MEDIUM]: [0.17, 0.21],
    [DIFFICULTY_TIERS.HARD]: [0.21, 0.25]
  };
  return {
    rows: [18, 22],
    cols: [20, 26],
    density: densityByTier[tier] || densityByTier[DIFFICULTY_TIERS.EASY],
    moveRatio: base.moveRatio
  };
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
  if (mode === GAME_MODES.CLASSIC || mode === GAME_MODES.FLAGS) {
    return null;
  }

  const ratio = range.moveRatio[0] + rng() * (range.moveRatio[1] - range.moveRatio[0]);

  if (mode === GAME_MODES.DETONATION) {
    return Math.max(8, Math.round(mines * 0.55 + activeCells * ratio * 0.22));
  }
  if (mode === GAME_MODES.TREASURE_HUNT) {
    if ((tier === DIFFICULTY_TIERS.EASY && rng() < 0.35) || (tier === DIFFICULTY_TIERS.MEDIUM && rng() < 0.15)) {
      return null;
    }
    const treasureRatios = {
      [DIFFICULTY_TIERS.EASY]: [0.55, 0.85],
      [DIFFICULTY_TIERS.MEDIUM]: [0.42, 0.68],
      [DIFFICULTY_TIERS.HARD]: [0.3, 0.52]
    };
    const [minRatio, maxRatio] = treasureRatios[tier] || treasureRatios[DIFFICULTY_TIERS.EASY];
    return Math.max(40, Math.round(activeCells * (minRatio + rng() * (maxRatio - minRatio))));
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

function calculateLives(mode, tier) {
  if (mode === GAME_MODES.FLAGS || mode === GAME_MODES.DETONATION) {
    return null;
  }
  return tier === DIFFICULTY_TIERS.HARD ? 1 : tier === DIFFICULTY_TIERS.MEDIUM ? 2 : 3;
}

function calculateXpReward(tier) {
  if (tier === DIFFICULTY_TIERS.HARD) {
    return 1500;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return 500;
  }
  return 250;
}

function calculateTimeLimit(tier) {
  if (tier === DIFFICULTY_TIERS.HARD) {
    return 10 * 60;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return 6 * 60;
  }
  return 3 * 60;
}

function calculateTimeLimitEnabled(rng, mode, tier) {
  if (mode === GAME_MODES.FLAGS) {
    return false;
  }
  if (mode === GAME_MODES.TAPS) {
    if (tier === DIFFICULTY_TIERS.HARD) {
      return 0;
    }
    if (tier === DIFFICULTY_TIERS.MEDIUM) {
      return 2;
    }
    return 3;
  }
  if (tier === DIFFICULTY_TIERS.HARD) {
    return rng() < 0.65;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return rng() < 0.45;
  }
  return rng() < 0.25;
}

function calculateInitialRevealCount(mode, tier) {
  if (mode === GAME_MODES.CLASSIC) {
    return 0;
  }
  if (mode === GAME_MODES.FLAGS) {
    if (tier === DIFFICULTY_TIERS.HARD) {
      return 36;
    }
    if (tier === DIFFICULTY_TIERS.MEDIUM) {
      return 32;
    }
    return 28;
  }
  if (tier === DIFFICULTY_TIERS.HARD) {
    return mode === GAME_MODES.TREASURE_HUNT ? 10 : 14;
  }
  if (tier === DIFFICULTY_TIERS.MEDIUM) {
    return mode === GAME_MODES.TREASURE_HUNT ? 14 : 18;
  }
  return mode === GAME_MODES.TREASURE_HUNT ? 18 : 24;
}
