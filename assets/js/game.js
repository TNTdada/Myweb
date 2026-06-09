const GAME_MODES = {
  CLASSIC: "classic",
  TAPS: "taps",
  TREASURE_HUNT: "treasure_hunt",
  DETONATION: "detonation",
  FLAGS: "flags"
};

const MODE_DEFINITIONS = {
  [GAME_MODES.CLASSIC]: { allowedActions: ["reveal", "flag"] },
  [GAME_MODES.TAPS]: { allowedActions: ["reveal"] },
  [GAME_MODES.TREASURE_HUNT]: { allowedActions: ["reveal", "flag"] },
  [GAME_MODES.DETONATION]: { allowedActions: ["reveal"] },
  [GAME_MODES.FLAGS]: { allowedActions: ["flag"] }
};

const SHAPE_TYPES = {
  RECTANGLE: "rectangle"
};

const CHALLENGE_TIER_RANGES = {
  easy: {
    rows: [8, 11],
    cols: [8, 12],
    density: [0.12, 0.16],
    moveRatio: [0.45, 0.62]
  },
  medium: {
    rows: [12, 16],
    cols: [12, 18],
    density: [0.15, 0.2],
    moveRatio: [0.34, 0.5]
  },
  hard: {
    rows: [16, 22],
    cols: [16, 24],
    density: [0.18, 0.24],
    moveRatio: [0.24, 0.4]
  }
};

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed) || 1;

  return function rng() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededShuffle(rng, items) {
  const copy = items.slice();

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }

  return copy;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function parseCellKey(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

function getShapeNeighbors(cell, shapeActiveSet) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const row = cell.row + rowOffset;
      const col = cell.col + colOffset;
      const key = cellKey(row, col);

      if (shapeActiveSet.has(key)) {
        neighbors.push({ row, col, key });
      }
    }
  }

  return neighbors;
}

function createActiveCells(shapeType, rows, cols, rng) {
  return createRectangle(rows, cols);
}

function createRectangle(rows, cols) {
  const active = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      active.push({ row, col, key: cellKey(row, col) });
    }
  }

  return active;
}

function isConnected(activeCells) {
  if (activeCells.length === 0) {
    return false;
  }

  const shapeActiveSet = new Set(activeCells.map((cell) => cell.key));
  const queue = [activeCells[0]];
  const visited = new Set([activeCells[0].key]);

  while (queue.length > 0) {
    const cell = queue.shift();
    for (const neighbor of getShapeNeighbors(cell, shapeActiveSet)) {
      if (!visited.has(neighbor.key)) {
        visited.add(neighbor.key);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === activeCells.length;
}

function chooseStartCell(rng, activeCells, shapeActiveSet) {
  const candidates = activeCells.filter((cell) => getShapeNeighbors(cell, shapeActiveSet).length >= 5);
  return seededShuffle(rng, candidates.length ? candidates : activeCells)[0];
}

function createMinefield(shapeConfig, rng) {
  const activeCells = createActiveCells(shapeConfig.shapeType, shapeConfig.rows, shapeConfig.cols, rng);
  const shapeActiveSet = new Set(activeCells.map((cell) => cell.key));

  if (!isConnected(activeCells)) {
    throw new Error("Generated map is not connected");
  }

  const startCell = chooseStartCell(rng, activeCells, shapeActiveSet);
  const protectedKeys = new Set([
    startCell.key,
    ...getShapeNeighbors(startCell, shapeActiveSet).map((cell) => cell.key)
  ]);
  const mineCandidates = activeCells.filter((cell) => !protectedKeys.has(cell.key));
  const mines = new Set(seededShuffle(rng, mineCandidates).slice(0, shapeConfig.mines).map((cell) => cell.key));

  const cells = activeCells.map((cell) => ({
    ...cell,
    isMine: mines.has(cell.key),
    adjacentMines: getShapeNeighbors(cell, shapeActiveSet).filter((neighbor) => mines.has(neighbor.key)).length
  }));

  return {
    rows: shapeConfig.rows,
    cols: shapeConfig.cols,
    shapeType: shapeConfig.shapeType,
    startKey: startCell.key,
    activeCells: cells,
    activeKeys: Array.from(shapeActiveSet),
    mineKeys: Array.from(mines)
  };
}

function createModeState(challengeConfig) {
  return {
    mode: challengeConfig.mode,
    movesUsed: 0,
    livesRemaining: typeof challengeConfig.lives === "number" ? challengeConfig.lives : null,
    mineMistakes: 0,
    revealedSafe: 0,
    detonatedMines: 0,
    correctFlags: 0,
    wrongFlags: 0,
    treasureFound: false,
    status: "playing"
  };
}

function applyModeAction(challengeConfig, state, action) {
  if (state.status !== "playing") {
    return state;
  }

  const next = { ...state };
  const actionType = action.type;
  const definition = MODE_DEFINITIONS[challengeConfig.mode];

  if (!definition.allowedActions.includes(actionType)) {
    return { ...next, status: "failed", reason: "该模式不允许此操作" };
  }

  next.movesUsed += actionType === "reveal" ? 1 : 0;

  if (challengeConfig.mode === GAME_MODES.DETONATION) {
    if (actionType === "reveal" && action.isMine) {
      next.detonatedMines += 1;
    } else if (actionType === "reveal") {
      next.mineMistakes += 1;
      if (typeof next.livesRemaining === "number") {
        next.livesRemaining -= 1;
      }
    }
  } else if (challengeConfig.mode === GAME_MODES.FLAGS) {
    if (typeof action.correctFlags === "number") {
      next.correctFlags = action.correctFlags;
    } else if (actionType === "flag" && action.isMine && action.flagged !== false) {
      next.correctFlags += 1;
    }

    if (typeof action.wrongFlags === "number") {
      next.wrongFlags = action.wrongFlags;
    } else if (actionType === "flag" && !action.isMine && action.flagged !== false) {
      next.wrongFlags += 1;
    }
  } else {
    if (actionType === "reveal" && action.isMine) {
      next.mineMistakes += 1;
      if (typeof next.livesRemaining === "number") {
        next.livesRemaining -= 1;
      }
    } else if (actionType === "reveal") {
      next.revealedSafe += Math.max(1, Number(action.revealedCount || 1));
    }
    if (challengeConfig.mode === GAME_MODES.TREASURE_HUNT && action.isTreasure) {
      next.treasureFound = true;
    }
  }

  return evaluateModeState(challengeConfig, next);
}

function evaluateModeState(challengeConfig, state) {
  const next = { ...state };

  if (challengeConfig.mode === GAME_MODES.CLASSIC || challengeConfig.mode === GAME_MODES.TAPS) {
    if (next.revealedSafe >= challengeConfig.targetCount) {
      return { ...next, status: "won", reason: "目标完成" };
    }
    if (typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
      return { ...next, status: "failed", reason: "生命值已耗尽" };
    }
    if (next.mineMistakes > challengeConfig.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challengeConfig.mode === GAME_MODES.TREASURE_HUNT) {
    if (next.treasureFound) {
      return { ...next, status: "won", reason: "找到宝藏" };
    }
    if (typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
      return { ...next, status: "failed", reason: "生命值已耗尽" };
    }
    if (next.mineMistakes > challengeConfig.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challengeConfig.mode === GAME_MODES.DETONATION && next.detonatedMines >= challengeConfig.targetCount) {
    return { ...next, status: "won", reason: "引爆目标完成" };
  }

  if (challengeConfig.mode === GAME_MODES.FLAGS && next.correctFlags >= challengeConfig.targetCount && next.wrongFlags === 0) {
    return { ...next, status: "won", reason: "插旗目标完成" };
  }

  if (challengeConfig.mode === GAME_MODES.DETONATION && typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
    return { ...next, status: "failed", reason: "机会已用完" };
  }

  const impossibleReason = getImpossibleReason(challengeConfig, next);
  if (impossibleReason) {
    return { ...next, status: "failed", reason: impossibleReason };
  }

  if (challengeConfig.moveLimit && next.movesUsed >= challengeConfig.moveLimit) {
    return { ...next, status: "failed", reason: "步数已用完" };
  }

  return next;
}

function getImpossibleReason(challengeConfig, state) {
  if (!challengeConfig.moveLimit) {
    return "";
  }

  const remainingMoves = challengeConfig.moveLimit - state.movesUsed;
  if (challengeConfig.mode === GAME_MODES.DETONATION) {
    const remainingTargets = challengeConfig.targetCount - state.detonatedMines;
    return remainingMoves < remainingTargets ? "剩余步数不足以完成引爆目标" : "";
  }
  return "";
}

function calculateChallengeScore(challengeConfig, state, elapsedSeconds) {
  const modeBonus = state.status === "won" ? 500 : 0;
  const progress = Math.max(
    state.revealedSafe,
    state.detonatedMines,
    state.correctFlags,
    state.treasureFound ? challengeConfig.targetCount : 0
  );
  const movePenalty = state.movesUsed * 3;
  const timePenalty = Math.floor(elapsedSeconds / 2);
  const mistakePenalty = (state.mineMistakes + state.wrongFlags) * 25;

  return Math.max(0, modeBonus + progress * 20 - movePenalty - timePenalty - mistakePenalty);
}

const DIFFICULTIES = {
  beginner: { label: "初级", rows: 9, cols: 9, mines: 10, multiplier: 1 },
  intermediate: { label: "中级", rows: 16, cols: 16, mines: 40, multiplier: 1.5 },
  expert: { label: "高级", rows: 30, cols: 16, mines: 99, multiplier: 2 }
};

const stateLabels = {
  loading: "读取中",
  ready: "准备中",
  playing: "游戏中",
  won: "胜利",
  lost: "失败"
};

const modeLabels = {
  [GAME_MODES.CLASSIC]: "经典",
  [GAME_MODES.TAPS]: "点开",
  [GAME_MODES.TREASURE_HUNT]: "寻宝",
  [GAME_MODES.DETONATION]: "引爆",
  [GAME_MODES.FLAGS]: "插旗"
};

const tierLabels = {
  easy: "简单",
  medium: "中等",
  hard: "困难"
};

const shapeLabels = {
  rectangle: "矩形",
  center_hole: "中心空洞",
  corner_blocks: "四角拼接"
};

const elements = {
  board: document.getElementById("board"),
  boardWrap: document.getElementById("boardWrap"),
  difficultyLabel: document.getElementById("difficultyLabel"),
  mineCounter: document.getElementById("mineCounter"),
  timer: document.getElementById("timer"),
  timerLabel: document.getElementById("timerLabel"),
  stateText: document.getElementById("stateText"),
  restartButton: document.getElementById("restartButton"),
  resultDialog: document.getElementById("resultDialog"),
  resultState: document.getElementById("resultState"),
  resultTitle: document.getElementById("resultTitle"),
  finalScore: document.getElementById("finalScore"),
  finalTime: document.getElementById("finalTime"),
  safeCells: document.getElementById("safeCells"),
  safeCellsLabel: document.getElementById("safeCellsLabel"),
  playAgainButton: document.getElementById("playAgainButton"),
  backLink: document.getElementById("backLink"),
  resultBackLink: document.getElementById("resultBackLink"),
  modeItem: document.getElementById("modeItem"),
  modeText: document.getElementById("modeText"),
  modeRuleButton: document.getElementById("modeRuleButton"),
  boardInfoItem: document.getElementById("boardInfoItem"),
  boardInfoText: document.getElementById("boardInfoText"),
  targetItem: document.getElementById("targetItem"),
  targetText: document.getElementById("targetText"),
  movesItem: document.getElementById("movesItem"),
  movesText: document.getElementById("movesText"),
  mistakeItem: document.getElementById("mistakeItem"),
  mistakeText: document.getElementById("mistakeText"),
  xpItem: document.getElementById("xpItem"),
  xpText: document.getElementById("xpText"),
  boardScan: document.getElementById("boardScan")
};

const params = new URLSearchParams(window.location.search);
const selectedDifficulty = params.get("difficulty");
const challengeId = params.get("challenge");

let config = DIFFICULTIES[selectedDifficulty] || DIFFICULTIES.beginner;
let challenge = null;
let minefield = null;
let challengeRunSeed = "";
let activeSet = new Set();
let treasureKey = null;
let board = [];
let gameState = challengeId ? "loading" : "ready";
let modeState = null;
let revealedSafeCells = 0;
let flagCount = 0;
let elapsedSeconds = 0;
let timerId = null;
let longPressTimer = null;
let longPressTriggered = false;
let longPressStart = null;
let longPressSuppressUntil = 0;
let boardPressStart = null;
let resizeFrame = null;
let revealOrigin = null;
let resultShown = false;
let endSequence = null;
const floatingTooltip = createFloatingTooltip();

function modeInfoFor(mode) {
  const shared = window.MywebModeInfo && window.MywebModeInfo[mode];
  return shared || {
    icon: "",
    label: modeLabels[mode] || mode || "经典",
    rule: "按照当前模式目标完成挑战。"
  };
}

function createFloatingTooltip() {
  const element = document.createElement("div");
  element.className = "floating-tooltip";
  element.hidden = true;
  document.body.appendChild(element);
  return element;
}

function showFloatingTooltip(anchor) {
  const text = anchor.dataset.tooltip || "";
  if (!text) {
    return;
  }
  floatingTooltip.textContent = text;
  const rect = anchor.getBoundingClientRect();
  floatingTooltip.hidden = false;
  const left = Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2));
  const top = Math.max(12, rect.top - floatingTooltip.offsetHeight - 10);
  floatingTooltip.style.left = `${left}px`;
  floatingTooltip.style.top = `${top}px`;
}

function hideFloatingTooltip() {
  floatingTooltip.hidden = true;
}

function normalizeChallenge(row) {
  const mode = row.mode;
  const tier = row.difficulty_tier;
  const xpReward = Number(row.xp_reward || xpRewardForTier(tier));

  return {
    id: row.id,
    title: row.title,
    challengeDate: row.challenge_date,
    slotIndex: row.slot_index,
    difficulty: row.difficulty,
    difficultyTier: row.difficulty_tier,
    mode,
    rows: null,
    cols: null,
    mines: null,
    shapeType: SHAPE_TYPES.RECTANGLE,
    targetCount: null,
    moveLimit: null,
    mineMistakeLimit: null,
    xpReward,
    lives: null,
    timeLimitEnabled: false,
    timeLimitSeconds: null,
    initialRevealCount: null,
    seed: row.seed,
    templateConfig: {
      rows: optionalNumber(row.rows),
      cols: optionalNumber(row.cols),
      mines: optionalNumber(row.mines),
      targetCount: optionalNumber(row.target_count),
      moveLimit: optionalNumber(row.move_limit),
      mineMistakeLimit: optionalNumber(row.mine_mistake_limit),
      lives: optionalNumber(row.lives),
      timeLimitEnabled: optionalBoolean(row.time_limit_enabled) || hasExplicitTimeLimit(row.time_limit_seconds, row.extra_rules),
      timeLimitSeconds: optionalNumber(row.time_limit_seconds),
      initialRevealCount: optionalNumber(row.initial_reveal_count),
      shapeType: row.shape_type || SHAPE_TYPES.RECTANGLE
    },
    sessionConfig: null,
    sessionSeed: ""
  };
}

function optionalNumber(value) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalBoolean(value) {
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function hasExplicitTimeLimit(seconds, extraRules) {
  if (optionalNumber(seconds)) {
    return true;
  }
  if (extraRules && typeof extraRules === "object") {
    return Boolean(extraRules.timeLimitEnabled);
  }
  return false;
}

function materializeChallengeSession(template) {
  const sessionSeed = `${template.seed || template.id}:session:${Date.now()}:${Math.floor(Math.random() * 1000000)}`;
  const rng = createRng(sessionSeed);
  const tier = template.difficultyTier || "easy";
  const mode = template.mode || GAME_MODES.CLASSIC;
  const range = challengeRangeForMode(mode, tier);
  const rows = randomInt(rng, range.rows[0], range.rows[1]);
  const cols = randomInt(rng, range.cols[0], range.cols[1]);
  const totalCells = rows * cols;
  const density = range.density[0] + rng() * (range.density[1] - range.density[0]);
  const mines = Math.max(5, Math.min(totalCells - 9, Math.round(totalCells * density)));
  const moveLimit = randomMoveLimitForMode(rng, mode, tier, totalCells, mines, range);
  const timeLimitEnabled = Boolean(template.templateConfig.timeLimitEnabled);
  const timeLimitSeconds = timeLimitEnabled
    ? template.templateConfig.timeLimitSeconds || defaultTimeLimitForTier(tier)
    : null;
  const sessionConfig = {
    rows,
    cols,
    mines,
    shapeType: SHAPE_TYPES.RECTANGLE,
    targetCount: defaultTargetCountForMode(mode, totalCells, mines),
    moveLimit,
    mineMistakeLimit: defaultMineMistakeLimitForMode(mode, tier),
    lives: defaultLivesForMode(mode, tier),
    timeLimitEnabled,
    timeLimitSeconds,
    initialRevealCount: defaultInitialRevealCountForMode(mode, tier),
    sessionSeed
  };

  return {
    ...template,
    ...sessionConfig,
    sessionSeed,
    sessionConfig: {
      ...sessionConfig,
      difficultyTier: tier,
      mode
    }
  };
}

function challengeRangeForMode(mode, tier) {
  const base = CHALLENGE_TIER_RANGES[tier] || CHALLENGE_TIER_RANGES.easy;
  if (mode !== GAME_MODES.TREASURE_HUNT) {
    return base;
  }

  const densityByTier = {
    easy: [0.13, 0.16],
    medium: [0.17, 0.21],
    hard: [0.21, 0.25]
  };
  return {
    rows: [18, 22],
    cols: [20, 26],
    density: densityByTier[tier] || densityByTier.easy,
    moveRatio: base.moveRatio
  };
}

function defaultTargetCountForMode(mode, totalCells, mines) {
  const safeCells = Math.max(1, totalCells - mines);
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
    return Math.max(3, Math.round(safeCells * 0.55));
  }
  return safeCells;
}

function randomMoveLimitForMode(rng, mode, tier, totalCells, mines, range) {
  if (mode === GAME_MODES.CLASSIC || mode === GAME_MODES.FLAGS) {
    return null;
  }

  const ratio = range.moveRatio[0] + rng() * (range.moveRatio[1] - range.moveRatio[0]);

  if (mode === GAME_MODES.DETONATION) {
    return Math.max(8, Math.round(mines * 0.55 + totalCells * ratio * 0.22));
  }
  if (mode === GAME_MODES.TREASURE_HUNT) {
    if ((tier === "easy" && rng() < 0.35) || (tier === "medium" && rng() < 0.15)) {
      return null;
    }
    const treasureRatios = {
      easy: [0.55, 0.85],
      medium: [0.42, 0.68],
      hard: [0.3, 0.52]
    };
    const [minRatio, maxRatio] = treasureRatios[tier] || treasureRatios.easy;
    return Math.max(40, Math.round(totalCells * (minRatio + rng() * (maxRatio - minRatio))));
  }

  return Math.max(12, Math.round(totalCells * ratio));
}

function defaultTimeLimitForTier(tier) {
  if (tier === "hard") {
    return 10 * 60;
  }
  if (tier === "medium") {
    return 6 * 60;
  }
  return 3 * 60;
}

function defaultMineMistakeLimitForMode(mode, tier) {
  if (mode === GAME_MODES.FLAGS || mode === GAME_MODES.DETONATION) {
    return 0;
  }
  if (tier === "easy") {
    return 2;
  }
  if (tier === "medium") {
    return 1;
  }
  return 0;
}

function defaultLivesForMode(mode, tier) {
  if (mode === GAME_MODES.FLAGS || mode === GAME_MODES.DETONATION) {
    return null;
  }
  return tier === "hard" ? 1 : tier === "medium" ? 2 : 3;
}

function defaultInitialRevealCountForMode(mode, tier) {
  if (mode === GAME_MODES.CLASSIC) {
    return 0;
  }
  if (mode === GAME_MODES.FLAGS) {
    if (tier === "hard") {
      return 36;
    }
    if (tier === "medium") {
      return 32;
    }
    return 28;
  }
  if (mode === GAME_MODES.TAPS) {
    if (tier === "hard") {
      return 0;
    }
    if (tier === "medium") {
      return 2;
    }
    return 3;
  }
  if (tier === "hard") {
    return mode === GAME_MODES.TREASURE_HUNT ? 10 : 14;
  }
  if (tier === "medium") {
    return mode === GAME_MODES.TREASURE_HUNT ? 14 : 18;
  }
  return mode === GAME_MODES.TREASURE_HUNT ? 18 : 24;
}

function xpRewardForTier(tier) {
  if (tier === "hard") {
    return 1500;
  }
  if (tier === "medium") {
    return 500;
  }
  return 250;
}

function createEmptyBoard() {
  board = Array.from({ length: config.rows }, (_, row) =>
    Array.from({ length: config.cols }, (_, col) => ({
      row,
      col,
      key: cellKey(row, col),
      isActive: true,
      isMine: false,
      adjacentMines: 0,
      isRevealed: false,
      isFlagged: false
    }))
  );
  activeSet = new Set(board.flat().map((cell) => cell.key));
}

function createChallengeBoard() {
  challengeRunSeed = challenge.sessionSeed || `${challenge.seed || challenge.id}:${Date.now()}:${Math.floor(Math.random() * 1000000)}`;
  const rng = createRng(challengeRunSeed);
  minefield = createMinefield(challenge, rng);
  activeSet = new Set(minefield.activeKeys);
  const cellsByKey = new Map(minefield.activeCells.map((cell) => [cell.key, cell]));

  board = Array.from({ length: challenge.rows }, (_, row) =>
    Array.from({ length: challenge.cols }, (_, col) => {
      const key = cellKey(row, col);
      const generated = cellsByKey.get(key);
      return {
        ...(generated || { row, col, key, isMine: false, adjacentMines: 0 }),
        isActive: true,
        isRevealed: false,
        isFlagged: false
      };
    })
  );

  treasureKey = challenge.mode === GAME_MODES.TREASURE_HUNT ? chooseTreasureKey() : null;
  if (treasureKey) {
    enforceTreasurePattern();
  }
}

function chooseTreasureKey() {
  const rng = createRng(`${challengeRunSeed}:treasure`);
  const candidates = minefield.activeCells
    .filter((cell) => !cell.isMine && cell.key !== minefield.startKey && !isEdgeCell(cell))
    .sort((a, b) => b.adjacentMines - a.adjacentMines || a.key.localeCompare(b.key));
  const risky = candidates.filter((cell) => cell.adjacentMines >= 2);
  return seededShuffle(rng, risky.length ? risky : candidates)[0]?.key || minefield.startKey;
}

function isEdgeCell(cell) {
  return cell.row <= 0 || cell.col <= 0 || cell.row >= challenge.rows - 1 || cell.col >= challenge.cols - 1;
}

function enforceTreasurePattern() {
  const treasure = getCellByKey(treasureKey);
  if (!treasure) {
    return;
  }

  const rng = createRng(`${challengeRunSeed}:treasure-pattern`);
  const protectedKeys = new Set([treasure.key]);
  const ring = getNeighbors(treasure.row, treasure.col).filter((cell) => cell.isActive);
  const ringMines = seededShuffle(rng, ring).slice(0, Math.min(ring.length, Math.max(3, challenge.mines - 1)));

  treasure.isMine = false;
  for (const cell of ring) {
    cell.isMine = false;
  }
  for (const cell of ringMines) {
    cell.isMine = true;
    protectedKeys.add(cell.key);
  }

  normalizeMineCount(protectedKeys, rng);
  recalculateAllNumbers();
}

function normalizeMineCount(protectedKeys, rng) {
  let mines = activeCells().filter((cell) => cell.isMine);
  const target = challenge.mines;

  if (mines.length > target) {
    const removable = seededShuffle(rng, mines.filter((cell) => !protectedKeys.has(cell.key)));
    for (const cell of removable.slice(0, mines.length - target)) {
      cell.isMine = false;
    }
  } else if (mines.length < target) {
    const fillable = seededShuffle(rng, activeCells().filter((cell) => !cell.isMine && !protectedKeys.has(cell.key)));
    for (const cell of fillable.slice(0, target - mines.length)) {
      cell.isMine = true;
    }
  }
}

function recalculateAllNumbers() {
  for (const cell of activeCells()) {
    cell.adjacentMines = getNeighbors(cell.row, cell.col).filter((neighbor) => neighbor.isMine).length;
  }
}

function getCellByKey(key) {
  const position = parseCellKey(key);
  return board[position.row] && board[position.row][position.col] ? board[position.row][position.col] : null;
}

async function initGame() {
  stopTimer();
  clearLongPressTimer();
  resetCounters();

  if (challengeId) {
    await initChallengeGame();
  } else {
    initClassicGame();
  }
}

function resetCounters() {
  revealedSafeCells = 0;
  flagCount = 0;
  elapsedSeconds = 0;
  modeState = null;
  revealOrigin = null;
  resultShown = false;
  clearEndSequence();
  elements.timer.textContent = "0";
  updateTimerDisplay();
  elements.board.innerHTML = "";
  document.body.classList.remove("is-ending", "is-dimmed");
  elements.boardWrap.classList.remove("is-resolving");
  if (elements.boardScan) {
    elements.boardScan.hidden = true;
    elements.boardScan.classList.remove("is-scanning");
  }
  if (elements.resultDialog.open) {
    elements.resultDialog.close();
  }
}

function initClassicGame() {
  config = DIFFICULTIES[selectedDifficulty] || DIFFICULTIES.beginner;
  challenge = null;
  minefield = null;
  treasureKey = null;
  createEmptyBoard();
  gameState = "ready";
  updateTimerDisplay();
  updateMineCounter();
  elements.stateText.textContent = stateLabels[gameState];
  elements.difficultyLabel.textContent = `${config.label} · ${config.rows} x ${config.cols} · ${config.mines} 雷`;
  setChallengeStatsVisible(false);
  updateModeRule(GAME_MODES.CLASSIC);
  updateBackLinks();
  renderBoard();
  updateBoardScale();
}

async function initChallengeGame() {
  setChallengeStatsVisible(true);
  gameState = "loading";
  elements.stateText.textContent = stateLabels[gameState];
  elements.difficultyLabel.textContent = "正在读取每日挑战";

  try {
    await waitForSupabaseClient();
    const row = await window.MywebSupabase.fetchDailyChallengeById(challengeId);
    challenge = materializeChallengeSession(normalizeChallenge(row));
    config = {
      label: `${tierLabels[challenge.difficultyTier] || "每日"}${modeLabels[challenge.mode] || "挑战"}`,
      rows: challenge.rows,
      cols: challenge.cols,
      mines: challenge.mines,
      multiplier: 1
    };
    createChallengeBoard();
    const safeCellCount = activeCells().length - challenge.mines;
    if (challenge.mode === GAME_MODES.CLASSIC) {
      challenge.targetCount = safeCellCount;
      challenge.mineMistakeLimit = 0;
    } else if (challenge.mode === GAME_MODES.TAPS) {
      challenge.targetCount = Math.min(challenge.targetCount, safeCellCount);
    } else if (challenge.mode === GAME_MODES.FLAGS) {
      challenge.moveLimit = null;
    }
    modeState = createModeState(challenge);
    applyInitialReveal();
    syncInitialProgress();
    gameState = "ready";
    updateTimerDisplay();
    updateMineCounter();
    elements.stateText.textContent = stateLabels[gameState];
    elements.difficultyLabel.textContent = buildChallengeHeading();
    updateBackLinks();
    renderBoard();
    updateChallengeStats();
    updateBoardScale();
  } catch (error) {
    console.error("Challenge load failed:", error);
    gameState = "lost";
    elements.stateText.textContent = "读取失败";
    elements.difficultyLabel.textContent = friendlyError(error, "每日挑战读取失败");
  }
}

function waitForSupabaseClient() {
  if (window.MywebSupabase) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.MywebSupabase) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > 4000) {
        window.clearInterval(timer);
        reject(new Error("Supabase 客户端未加载"));
      }
    }, 50);
  });
}

function buildChallengeHeading() {
  const mode = modeLabels[challenge.mode] || challenge.mode;
  const tier = tierLabels[challenge.difficultyTier] || challenge.difficultyTier;
  const shape = shapeLabels[challenge.shapeType] || challenge.shapeType;
  return `${challenge.title || "每日挑战"} · ${mode} · ${tier} · ${shape}`;
}

function updateBackLinks() {
  const href = challenge
    ? `daily.html?date=${encodeURIComponent(challenge.challengeDate || "")}`
    : "index.html";
  const label = challenge ? "返回每日挑战" : "返回首页";
  for (const link of [elements.backLink, elements.resultBackLink]) {
    if (!link) {
      continue;
    }
    link.href = href;
    link.textContent = label;
  }
}

function friendlyError(error, fallback) {
  if (window.MywebSupabase && typeof window.MywebSupabase.friendlyError === "function") {
    return window.MywebSupabase.friendlyError(error, fallback);
  }
  return fallback;
}

function setChallengeStatsVisible(visible) {
  for (const element of [elements.modeItem, elements.targetItem, elements.movesItem, elements.mistakeItem]) {
    if (element) {
      element.hidden = !visible;
    }
  }
}

function applyInitialReveal() {
  if (!challenge || challenge.mode === GAME_MODES.CLASSIC || !challenge.initialRevealCount) {
    return;
  }

  if (challenge.mode === GAME_MODES.FLAGS) {
    revealFlagModeOpenings();
    return;
  }
  if (challenge.mode === GAME_MODES.TAPS) {
    revealTapsOpenings();
    return;
  }

  revealOpeningAreas(challenge.initialRevealCount);
}

function syncInitialProgress() {
  if (!challenge || !modeState) {
    return;
  }

  if (challenge.mode === GAME_MODES.TAPS) {
    modeState.revealedSafe = revealedSafeCells;
  }
}

function chooseInitialRevealCell(usedKeys) {
  const safeCells = activeCells().filter((cell) =>
    !cell.isMine &&
    !cell.isRevealed &&
    cell.key !== treasureKey &&
    !usedKeys.has(cell.key)
  );
  const zeroCells = safeCells.filter((cell) => cell.adjacentMines === 0);

  if (challenge.mode === GAME_MODES.TREASURE_HUNT && treasureKey) {
    const treasure = getCellByKey(treasureKey);
    const candidates = zeroCells.length ? zeroCells : safeCells;
    return candidates.sort((a, b) => distanceSquared(b, treasure) - distanceSquared(a, treasure))[0] || getCellByKey(minefield.startKey);
  }

  const start = getCellByKey(minefield.startKey);
  if (start && !start.isMine && !start.isRevealed && !usedKeys.has(start.key) && start.adjacentMines === 0) {
    return start;
  }
  return (zeroCells.length ? zeroCells : safeCells)
    .sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b))[0] || null;
}

function distanceSquared(a, b) {
  if (!a || !b) {
    return 0;
  }
  return (a.row - b.row) ** 2 + (a.col - b.col) ** 2;
}

function distanceFromCenter(cell) {
  return (cell.row - (challenge.rows - 1) / 2) ** 2 + (cell.col - (challenge.cols - 1) / 2) ** 2;
}

function revealOpeningAreas(targetCount) {
  const usedKeys = new Set();
  const maxAreas = 3;

  for (let area = 0; area < maxAreas; area += 1) {
    if (countInitialRevealedCells() >= targetCount) {
      return;
    }

    const start = chooseInitialRevealCell(usedKeys);
    if (!start) {
      return;
    }

    const opening = collectNaturalOpening(start);
    for (const cell of opening) {
      if (!cell.isRevealed && !cell.isMine && cell.key !== treasureKey) {
        cell.isRevealed = true;
        revealedSafeCells += 1;
      }
      usedKeys.add(cell.key);
    }
  }
}

function revealFlagModeOpenings() {
  const rng = createRng(`${challengeRunSeed}:flag-openings`);
  const ratio = flagFrontierRatio();
  const mainTarget = Math.max(8, Math.round(challenge.initialRevealCount * 0.7));
  revealOpeningAreas(mainTarget);

  const maxPatches = challenge.difficultyTier === "hard" ? 8 : challenge.difficultyTier === "medium" ? 10 : 12;
  for (let patch = 0; patch < maxPatches; patch += 1) {
    const stats = countFlagFrontier();
    if (stats.frontierMineCount >= challenge.targetCount * ratio) {
      break;
    }
    revealScatteredFlagPatch(rng, patch);
  }

  const stats = countFlagFrontier();
  if (stats.frontierMineCount > 0) {
    const cappedTarget = Math.max(1, Math.floor(stats.frontierMineCount / ratio));
    challenge.targetCount = Math.max(1, Math.min(challenge.targetCount, cappedTarget, challenge.mines));
  }
}

function revealTapsOpenings() {
  if (!challenge.initialRevealCount) {
    return;
  }

  const rng = createRng(`${challengeRunSeed}:tap-openings`);
  const candidates = seededShuffle(rng, activeCells().filter((cell) =>
    !cell.isMine &&
    !cell.isRevealed &&
    cell.key !== treasureKey &&
    cell.adjacentMines > 0
  ));
  for (const cell of candidates.slice(0, challenge.initialRevealCount)) {
    cell.isRevealed = true;
    revealedSafeCells += 1;
  }
}

function flagFrontierRatio() {
  if (challenge.difficultyTier === "hard") {
    return 1.05;
  }
  if (challenge.difficultyTier === "medium") {
    return 1.15;
  }
  return 1.25;
}

function countFlagFrontier() {
  const frontier = new Set();
  for (const cell of activeCells()) {
    if (!cell.isRevealed || cell.isMine) {
      continue;
    }
    for (const neighbor of getNeighbors(cell.row, cell.col)) {
      if (!neighbor.isRevealed) {
        frontier.add(neighbor.key);
      }
    }
  }

  let frontierMineCount = 0;
  for (const key of frontier) {
    const cell = getCellByKey(key);
    if (cell && cell.isMine) {
      frontierMineCount += 1;
    }
  }

  return {
    frontier,
    frontierMineCount
  };
}

function revealScatteredFlagPatch(rng, patchIndex) {
  const candidates = activeCells().filter((cell) =>
    !cell.isMine &&
    !cell.isRevealed &&
    cell.key !== treasureKey &&
    cell.adjacentMines > 0
  );
  if (candidates.length === 0) {
    return;
  }

  const shuffled = seededShuffle(rng, candidates);
  const center = shuffled[patchIndex % shuffled.length];
  const radiusRoll = rng();
  const radius = radiusRoll < 0.45 ? 0 : 1;
  revealSafePatch(center, radius);
}

function revealSafePatch(center, radius) {
  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      const cell = board[row] && board[row][col];
      if (!cell || cell.isMine || cell.isRevealed || cell.key === treasureKey) {
        continue;
      }
      cell.isRevealed = true;
      revealedSafeCells += 1;
    }
  }
}

function countInitialRevealedCells() {
  return activeCells().filter((cell) => cell.isRevealed && !cell.isMine).length;
}

function collectNaturalOpening(start) {
  const queue = [start];
  const visited = new Set();
  const opening = [];

  while (queue.length > 0) {
    const cell = queue.shift();
    if (!cell || visited.has(cell.key) || cell.isMine || cell.key === treasureKey) {
      continue;
    }

    visited.add(cell.key);
    opening.push(cell);

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(cell.row, cell.col)) {
        if (!neighbor.isMine && !visited.has(neighbor.key) && neighbor.key !== treasureKey) {
          queue.push(neighbor);
        }
      }
    }
  }

  return opening;
}

function renderBoard() {
  const fragment = document.createDocumentFragment();
  elements.board.style.gridTemplateColumns = `repeat(${config.cols}, var(--cell-size))`;

  for (const row of board) {
    for (const cell of row) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.row = String(cell.row);
      button.dataset.col = String(cell.col);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", buildCellLabel(cell));
      fragment.appendChild(button);
    }
  }

  elements.board.appendChild(fragment);
  for (const cell of activeCells()) {
    updateCell(cell);
  }
}

function updateCell(cell, hitMine, options = {}) {
  const button = getCellButton(cell);
  if (!button) {
    return;
  }

  button.className = "cell";
  button.textContent = "";
  button.setAttribute("aria-label", buildCellLabel(cell));

  if (cell.isRevealed) {
    button.classList.add("revealed");
    button.disabled = true;
    if (options.animate !== false && !cell.isMine) {
      const origin = revealOrigin || cell;
      const delay = Math.min(180, (Math.abs(cell.row - origin.row) + Math.abs(cell.col - origin.col)) * 18);
      button.style.setProperty("--reveal-delay", `${delay}ms`);
      button.classList.add("revealed-pop");
    }

    if (cell.isMine) {
      button.classList.add("mine");
      button.textContent = "💣";
      if (hitMine) {
        button.classList.add("hit", "mine-hit");
      }
      if (options.detonated) {
        button.classList.add("detonated");
      }
    } else if (cell.key === treasureKey && gameState !== "playing") {
      button.classList.add("treasure");
      button.textContent = "★";
    } else if (cell.adjacentMines > 0) {
      button.textContent = String(cell.adjacentMines);
      button.classList.add(`n${cell.adjacentMines}`);
    }
    return;
  }

  button.disabled = isGameOver();
  if (cell.isFlagged) {
    button.classList.add("flagged");
    button.textContent = "🚩";
  }
}

function buildCellLabel(cell) {
  if (cell.isRevealed && cell.isMine) {
    return "地雷";
  }
  if (cell.isRevealed && cell.key === treasureKey) {
    return "宝藏";
  }
  if (cell.isRevealed && cell.adjacentMines > 0) {
    return `周围 ${cell.adjacentMines} 个地雷`;
  }
  if (cell.isRevealed) {
    return "空白安全格";
  }
  if (cell.isFlagged) {
    return "已插旗";
  }
  return "未翻开格";
}

function getCellButton(cell) {
  return elements.board.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
}

function getCellFromEvent(event) {
  const target = event.target.closest(".cell[data-row]");
  if (!target || !elements.board.contains(target)) {
    return null;
  }

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  return board[row] && board[row][col] ? board[row][col] : null;
}

function startGame(firstCell) {
  if (challenge) {
    gameState = "playing";
  } else {
    placeMines(firstCell);
    calculateNumbers();
    gameState = "playing";
  }
  elements.stateText.textContent = stateLabels[gameState];
  startTimer();
}

function placeMines(firstCell) {
  const protectedCells = new Set(
    getNeighbors(firstCell.row, firstCell.col)
      .concat(firstCell)
      .map((cell) => cell.key)
  );

  const candidates = [];
  const fallbackCandidates = [];
  for (const cell of activeCells()) {
    fallbackCandidates.push(cell);
    if (!protectedCells.has(cell.key)) {
      candidates.push(cell);
    }
  }

  const pool = candidates.length >= config.mines ? candidates : fallbackCandidates.filter((cell) => cell !== firstCell);
  shuffle(pool);

  for (let index = 0; index < config.mines; index += 1) {
    pool[index].isMine = true;
  }
}

function calculateNumbers() {
  for (const cell of activeCells()) {
    cell.adjacentMines = getNeighbors(cell.row, cell.col).filter((neighbor) => neighbor.isMine).length;
  }
}

function getNeighbors(row, col) {
  if (challenge) {
    return getShapeNeighbors({ row, col, key: cellKey(row, col) }, activeSet)
      .map((neighbor) => board[neighbor.row][neighbor.col])
      .filter(Boolean);
  }

  const neighbors = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < config.rows && nextCol >= 0 && nextCol < config.cols) {
        neighbors.push(board[nextRow][nextCol]);
      }
    }
  }
  return neighbors;
}

function activeCells() {
  return board.flat();
}

function revealCell(cell) {
  if (!cell || isGameOver() || cell.isRevealed || cell.isFlagged) {
    return;
  }

  revealOrigin = cell;

  if (challenge && challenge.mode === GAME_MODES.FLAGS) {
    return;
  }

  if (gameState === "ready") {
    startGame(cell);
  }

  if (challenge) {
    revealChallengeCell(cell);
    return;
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    updateCell(cell, true);
    endGame("lost", cell);
    return;
  }

  const revealedCount = cell.adjacentMines === 0 ? revealEmptyArea(cell) : revealSafeCell(cell);
  if (revealedCount > 0) {
    checkWin();
  }
}

function revealChallengeCell(cell) {
  if (challenge.mode === GAME_MODES.DETONATION) {
    if (cell.isMine) {
      cell.isRevealed = true;
      updateCell(cell, true, { detonated: true });
      revealDetonationBlast(cell);
      applyChallengeAction({ type: "reveal", isMine: true });
      return;
    }

    const revealedCount = cell.adjacentMines === 0 ? revealEmptyArea(cell) : revealSafeCell(cell);
    if (revealedCount > 0) {
      applyChallengeAction({ type: "reveal", isMine: false, revealedCount });
    }
    return;
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    updateCell(cell, true);
    applyChallengeAction({ type: "reveal", isMine: true });
    return;
  }

  const beforeTreasure = isTreasureRevealed();
  const revealedCount = cell.adjacentMines === 0 ? revealEmptyArea(cell) : revealSafeCell(cell);
  const afterTreasure = isTreasureRevealed();

  if (revealedCount > 0) {
    applyChallengeAction({
      type: "reveal",
      isMine: false,
      revealedCount,
      isTreasure: !beforeTreasure && afterTreasure
    });
  }
}

function revealDetonationBlast(mineCell) {
  const hiddenMineNeighbors = getNeighbors(mineCell.row, mineCell.col)
    .filter((neighbor) => neighbor.isMine && !neighbor.isRevealed);
  if (hiddenMineNeighbors.length > 0) {
    return;
  }

  for (const neighbor of getNeighbors(mineCell.row, mineCell.col)) {
    if (!neighbor.isMine && !neighbor.isRevealed && !neighbor.isFlagged) {
      revealSafeCell(neighbor);
    }
  }
}

function isTreasureRevealed() {
  return treasureKey ? board.flat().some((item) => item.key === treasureKey && item.isRevealed) : false;
}

function revealSafeCell(cell) {
  if (cell.isRevealed || cell.isFlagged || cell.isMine) {
    return 0;
  }

  cell.isRevealed = true;
  revealedSafeCells += 1;
  updateCell(cell);
  return 1;
}

function revealEmptyArea(startCell) {
  const queue = [startCell];
  const visited = new Set();
  let count = 0;

  while (queue.length > 0) {
    const cell = queue.shift();
    if (visited.has(cell.key) || cell.isFlagged || cell.isRevealed || cell.isMine) {
      continue;
    }

    visited.add(cell.key);
    count += revealSafeCell(cell);

    if (cell.adjacentMines === 0) {
      for (const neighbor of getNeighbors(cell.row, cell.col)) {
        if (!neighbor.isMine && !neighbor.isFlagged && !neighbor.isRevealed) {
          queue.push(neighbor);
        }
      }
    }
  }

  return count;
}

function toggleFlag(cell) {
  if (!cell || isGameOver() || cell.isRevealed) {
    return;
  }

  if (challenge && !MODE_DEFINITIONS[challenge.mode].allowedActions.includes("flag")) {
    return;
  }

  if (gameState === "ready") {
    startGame(cell);
  }

  const wasFlagged = cell.isFlagged;
  cell.isFlagged = !cell.isFlagged;
  flagCount += cell.isFlagged ? 1 : -1;
  updateMineCounter();
  updateCell(cell);

  if (challenge) {
    const correctFlags = activeCells().filter((item) => item.isMine && item.isFlagged).length;
    const wrongFlags = activeCells().filter((item) => !item.isMine && item.isFlagged).length;
    applyChallengeAction({
      type: "flag",
      isMine: cell.isMine,
      flagged: cell.isFlagged,
      wasFlagged,
      correctFlags,
      wrongFlags
    });
  }
}

function applyChallengeAction(action) {
  modeState = applyModeAction(challenge, modeState, action);
  updateChallengeStats();

  if (modeState.status === "won") {
    endGame("won");
  } else if (modeState.status === "failed") {
    endGame("lost");
  }
}

function isGameOver() {
  return gameState === "won" || gameState === "lost";
}

function checkWin() {
  if (revealedSafeCells === activeCells().length - config.mines) {
    endGame("won");
  }
}

function endGame(result, hitCell) {
  if (isGameOver()) {
    return;
  }

  gameState = result;
  stopTimer();
  elements.stateText.textContent = stateLabels[gameState];
  lockBoard();
  playEndSequence(result, hitCell);
}

function clearEndSequence() {
  if (!endSequence) {
    return;
  }

  for (const timer of endSequence.timers) {
    window.clearTimeout(timer);
  }
  document.removeEventListener("pointerdown", endSequence.skip, true);
  document.removeEventListener("keydown", endSequence.skip, true);
  endSequence = null;
}

function playEndSequence(result, hitCell) {
  clearEndSequence();
  document.body.classList.add("is-ending");
  elements.boardWrap.classList.add("is-resolving");

  const finish = () => finishEndSequence(result, hitCell);
  const skip = (event) => {
    if (event.target === elements.resultDialog || elements.resultDialog.contains(event.target)) {
      return;
    }
    finish();
  };
  endSequence = { timers: [], skip };
  document.addEventListener("pointerdown", skip, true);
  document.addEventListener("keydown", skip, true);

  if (result === "won") {
    runVictoryScan(finish);
    return;
  }

  const delay = hitCell ? 320 : 120;
  endSequence.timers.push(window.setTimeout(finish, delay));
}

function runVictoryScan(onDone) {
  if (!elements.boardScan) {
    endSequence.timers.push(window.setTimeout(onDone, 420));
    return;
  }

  const wrapRect = elements.boardWrap.getBoundingClientRect();
  const boardRect = elements.board.getBoundingClientRect();
  const scanHeight = Math.max(18, Math.min(34, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cell-size")) || 28));
  const scanDistance = Math.max(0, boardRect.height - scanHeight);
  elements.boardScan.style.left = `${boardRect.left - wrapRect.left + elements.boardWrap.scrollLeft}px`;
  elements.boardScan.style.top = `${boardRect.top - wrapRect.top + elements.boardWrap.scrollTop}px`;
  elements.boardScan.style.width = `${boardRect.width}px`;
  elements.boardScan.style.height = `${scanHeight}px`;
  elements.boardScan.style.setProperty("--scan-distance", `${scanDistance}px`);
  elements.boardScan.hidden = false;
  elements.boardScan.classList.remove("is-scanning");

  const mines = activeCells()
    .filter((cell) => cell.isMine)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const duration = Math.max(1200, Math.round((config.rows / 5) * 1000));
  elements.boardScan.style.setProperty("--scan-duration", `${duration}ms`);
  elements.boardScan.getBoundingClientRect();
  elements.boardScan.classList.add("is-scanning");
  for (const cell of mines) {
    const delay = Math.round((cell.row / Math.max(1, config.rows - 1)) * duration);
    endSequence.timers.push(window.setTimeout(() => {
      cell.isRevealed = true;
      updateCell(cell, false, { animate: false });
    }, delay));
  }

  endSequence.timers.push(window.setTimeout(onDone, duration + 180));
}

function finishEndSequence(result, hitCell) {
  if (resultShown) {
    return;
  }

  clearEndSequence();
  revealMines(hitCell);
  revealTreasure();
  document.body.classList.add("is-dimmed");
  elements.boardWrap.classList.remove("is-resolving");
  if (elements.boardScan) {
    elements.boardScan.hidden = true;
    elements.boardScan.classList.remove("is-scanning");
  }
  window.setTimeout(() => showResult(result), 80);
}

function revealMines(hitCell) {
  for (const cell of activeCells()) {
    if (cell.isMine) {
      cell.isRevealed = true;
      updateCell(cell, cell === hitCell);
    }
  }
}

function revealTreasure() {
  if (!treasureKey) {
    return;
  }

  const treasure = board.flat().find((cell) => cell.key === treasureKey);
  if (treasure) {
    treasure.isRevealed = true;
    updateCell(treasure);
  }
}

function lockBoard() {
  elements.board.querySelectorAll(".cell[data-row]").forEach((button) => {
    button.disabled = true;
  });
}

function showResult(result) {
  if (resultShown) {
    return;
  }
  resultShown = true;
  const score = calculateScore(result);
  elements.resultState.textContent = result === "won" ? "Clear" : "Game Over";
  elements.resultTitle.textContent = buildResultTitle(result);
  elements.finalScore.textContent = String(score);
  elements.finalTime.textContent = String(elapsedSeconds);
  elements.safeCellsLabel.textContent = challenge ? buildProgressLabel() : "翻开安全格";
  elements.safeCells.textContent = buildProgressText();
  elements.resultDialog.showModal();

  if (challenge) {
    saveChallengeResult(result, score);
  } else {
    saveGameResult(result, score);
  }
}

function buildResultTitle(result) {
  if (!challenge) {
    return result === "won" ? "恭喜通关" : "踩到地雷";
  }
  if (result === "won") {
    return `${modeLabels[challenge.mode] || "挑战"}成功`;
  }
  return modeState?.reason || "挑战失败";
}

async function saveGameResult(result, score) {
  if (!window.MywebSupabase) {
    return;
  }

  try {
    const supabase = window.MywebSupabase.getClient();
    const user = await window.MywebSupabase.getCurrentUser();
    if (!user) {
      return;
    }

    await supabase.from("game_results").insert({
      user_id: user.id,
      difficulty: selectedDifficulty && DIFFICULTIES[selectedDifficulty] ? selectedDifficulty : "beginner",
      score,
      won: result === "won",
      elapsed_seconds: elapsedSeconds,
      mode: "classic"
    });
  } catch (error) {
    console.warn("Game result was not saved:", error);
  }
}

async function saveChallengeResult(result, score) {
  if (!window.MywebSupabase || !challenge) {
    return;
  }

  try {
    await window.MywebSupabase.saveDailyResult({
      challenge,
      score,
      won: result === "won",
      elapsedSeconds,
      movesUsed: modeState?.movesUsed || 0,
      targetProgress: getChallengeProgressValue(),
      sessionConfig: challenge.sessionConfig || null
    });
  } catch (error) {
    console.warn("Daily result was not saved:", error);
  }
}

function showStoredResult() {
  if (isGameOver() && !elements.resultDialog.open) {
    elements.resultDialog.showModal();
  }
}

function calculateScore(result) {
  if (challenge) {
    return calculateChallengeScore(challenge, modeState || createModeState(challenge), elapsedSeconds);
  }

  const correctFlags = activeCells().filter((cell) => cell.isMine && cell.isFlagged).length;
  const winBonus = result === "won" ? config.mines * 20 : 0;
  const baseScore = revealedSafeCells * 10 + correctFlags * 5 - elapsedSeconds * 2 + winBonus;
  return Math.max(0, Math.round(baseScore * config.multiplier));
}

function updateMineCounter() {
  const totalMines = config && typeof config.mines === "number" ? config.mines : 0;
  elements.mineCounter.textContent = `${Math.max(0, totalMines - flagCount)}/${totalMines}`;
}

function updateModeRule(mode) {
  if (!elements.modeRuleButton) {
    return;
  }

  const info = modeInfoFor(mode);
  elements.modeRuleButton.dataset.tooltip = info.rule;
  elements.modeRuleButton.title = info.rule;
  elements.modeRuleButton.setAttribute("aria-label", `${info.label}规则：${info.rule}`);
}

function updateChallengeStats() {
  if (!challenge || !modeState) {
    return;
  }

  const info = modeInfoFor(challenge.mode);
  elements.modeText.textContent = `${info.icon ? `${info.icon} ` : ""}${info.label || modeLabels[challenge.mode] || challenge.mode}`;
  updateModeRule(challenge.mode);
  const isFlagsMode = challenge.mode === GAME_MODES.FLAGS;
  const hideLifeCard = challenge.mode === GAME_MODES.FLAGS || challenge.mode === GAME_MODES.DETONATION;
  if (elements.movesItem) {
    elements.movesItem.hidden = isFlagsMode;
  }
  if (elements.mistakeItem) {
    elements.mistakeItem.hidden = hideLifeCard;
  }
  if (elements.boardInfoText) {
    elements.boardInfoText.textContent = `${challenge.rows} x ${challenge.cols} · ${challenge.mines} 雷`;
  }
  elements.targetText.textContent = buildProgressText();
  elements.movesText.textContent = challenge.moveLimit
    ? `${Math.max(0, challenge.moveLimit - modeState.movesUsed)}/${challenge.moveLimit}`
    : "不限";
  elements.mistakeText.textContent = buildMistakeText();
  elements.mistakeText.classList.toggle("is-low-life", isLowLifeWarning());
  if (elements.xpText) {
    elements.xpText.textContent = `${challenge.xpReward || 0} XP`;
  }
}

function isLowLifeWarning() {
  if (!challenge || !modeState || challenge.mode === GAME_MODES.FLAGS) {
    return false;
  }
  return typeof modeState.livesRemaining === "number" && modeState.livesRemaining === 1;
}

function buildProgressLabel() {
  if (!challenge) {
    return "翻开安全格";
  }
  if (challenge.mode === GAME_MODES.DETONATION) {
    return "引爆进度";
  }
  if (challenge.mode === GAME_MODES.FLAGS) {
    return "插旗进度";
  }
  if (challenge.mode === GAME_MODES.TREASURE_HUNT) {
    return "寻宝结果";
  }
  return "目标进度";
}

function buildProgressText() {
  if (!challenge || !modeState) {
    return `${revealedSafeCells}/${activeCells().length - config.mines}`;
  }
  if (challenge.mode === GAME_MODES.DETONATION) {
    return `${modeState.detonatedMines}/${challenge.targetCount}`;
  }
  if (challenge.mode === GAME_MODES.FLAGS) {
    return `${flagCount}/${challenge.targetCount}`;
  }
  if (challenge.mode === GAME_MODES.TREASURE_HUNT) {
    return modeState.treasureFound ? "已找到" : "未找到";
  }
  return `${modeState.revealedSafe}/${challenge.targetCount}`;
}

function getChallengeProgressValue() {
  if (!modeState) {
    return 0;
  }
  if (challenge.mode === GAME_MODES.DETONATION) {
    return modeState.detonatedMines;
  }
  if (challenge.mode === GAME_MODES.FLAGS) {
    return modeState.correctFlags;
  }
  if (challenge.mode === GAME_MODES.TREASURE_HUNT) {
    return modeState.treasureFound ? 1 : 0;
  }
  return modeState.revealedSafe;
}

function buildMistakeText() {
  if (challenge.mode === GAME_MODES.FLAGS) {
    return "不提示";
  }
  if (challenge.mode === GAME_MODES.DETONATION) {
    if (typeof modeState.livesRemaining === "number") {
      return `${Math.max(0, modeState.livesRemaining)}/${challenge.lives}`;
    }
    return "不计";
  }
  if (typeof modeState.livesRemaining === "number") {
    return `${Math.max(0, modeState.livesRemaining)}/${challenge.lives}`;
  }
  return `${modeState.mineMistakes}/${challenge.mineMistakeLimit}`;
}

function startTimer() {
  stopTimer();
  timerId = window.setInterval(() => {
    elapsedSeconds += 1;
    updateTimerDisplay();
    checkTimeLimit();
  }, 1000);
}

function updateTimerDisplay() {
  if (challenge && challenge.timeLimitSeconds) {
    const remaining = Math.max(0, challenge.timeLimitSeconds - elapsedSeconds);
    if (elements.timerLabel) {
      elements.timerLabel.textContent = "用时 / 限时";
    }
    elements.timer.textContent = `${formatClock(elapsedSeconds)} / ${formatClock(challenge.timeLimitSeconds)}  剩余 ${formatClock(remaining)}`;
    return;
  }

  if (elements.timerLabel) {
    elements.timerLabel.textContent = "用时";
  }
  elements.timer.textContent = `${elapsedSeconds}s`;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function checkTimeLimit() {
  if (!challenge || !challenge.timeLimitSeconds || isGameOver()) {
    return;
  }

  if (elapsedSeconds >= challenge.timeLimitSeconds) {
    modeState = {
      ...(modeState || createModeState(challenge)),
      status: "failed",
      reason: "时间已用完"
    };
    endGame("lost");
  }
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

function updateBoardScale() {
  const maxCellSize = 34;
  const minCellSize = 22;
  const gridGap = 1;
  const boardBorder = 4;
  const availableWidth = elements.boardWrap.clientWidth - 8;
  const widthForCells = availableWidth - boardBorder - gridGap * (config.cols - 1);
  const fittedCellSize = Math.floor(widthForCells / config.cols);
  const cellSize = Math.max(minCellSize, Math.min(maxCellSize, fittedCellSize));

  elements.board.style.setProperty("--cell-size", `${cellSize}px`);
}

function scheduleBoardScaleUpdate() {
  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    updateBoardScale();
  });
}

function clearLongPressTimer() {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function getPointerDistance(start, event) {
  if (!start) {
    return 0;
  }

  return Math.hypot(event.clientX - start.x, event.clientY - start.y);
}

function isLongPressSuppressed() {
  return Date.now() < longPressSuppressUntil;
}

elements.board.addEventListener("click", (event) => {
  if (longPressTriggered || isLongPressSuppressed()) {
    longPressTriggered = false;
    return;
  }
  revealCell(getCellFromEvent(event));
});

elements.board.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (longPressTriggered || isLongPressSuppressed()) {
    return;
  }
  toggleFlag(getCellFromEvent(event));
});

elements.board.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") {
    return;
  }

  const cell = getCellFromEvent(event);
  if (!cell) {
    return;
  }

  longPressTriggered = false;
  longPressStart = {
    x: event.clientX,
    y: event.clientY
  };
  longPressTimer = window.setTimeout(() => {
    longPressTriggered = true;
    longPressSuppressUntil = Date.now() + 1000;
    toggleFlag(cell);
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
  }, 520);
});

elements.board.addEventListener("pointermove", (event) => {
  if (getPointerDistance(longPressStart, event) > 10) {
    clearLongPressTimer();
  }
});

elements.board.addEventListener("pointerup", () => {
  clearLongPressTimer();
  longPressStart = null;
  if (longPressTriggered) {
    window.setTimeout(() => {
      longPressTriggered = false;
    }, 350);
  }
});

elements.board.addEventListener("pointercancel", () => {
  clearLongPressTimer();
  longPressStart = null;
});

elements.resultDialog.addEventListener("click", (event) => {
  if (event.target === elements.resultDialog && isGameOver()) {
    elements.resultDialog.close();
  }
});

elements.boardWrap.addEventListener("pointerdown", (event) => {
  boardPressStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: elements.boardWrap.scrollLeft,
    scrollTop: elements.boardWrap.scrollTop
  };
});

elements.boardWrap.addEventListener("pointerup", (event) => {
  if (!boardPressStart) {
    return;
  }

  const pointerMoved = getPointerDistance(boardPressStart, event) > 8;
  const scrollMoved =
    Math.abs(elements.boardWrap.scrollLeft - boardPressStart.scrollLeft) > 2 ||
    Math.abs(elements.boardWrap.scrollTop - boardPressStart.scrollTop) > 2;

  boardPressStart = null;
  if (!pointerMoved && !scrollMoved) {
    showStoredResult();
  }
});

elements.boardWrap.addEventListener("pointercancel", () => {
  boardPressStart = null;
});

window.addEventListener("resize", scheduleBoardScaleUpdate);
if (elements.modeRuleButton) {
  elements.modeRuleButton.addEventListener("mouseenter", () => showFloatingTooltip(elements.modeRuleButton));
  elements.modeRuleButton.addEventListener("focus", () => showFloatingTooltip(elements.modeRuleButton));
  elements.modeRuleButton.addEventListener("mouseleave", hideFloatingTooltip);
  elements.modeRuleButton.addEventListener("blur", hideFloatingTooltip);
}
elements.restartButton.addEventListener("click", initGame);
elements.playAgainButton.addEventListener("click", initGame);

initGame();
