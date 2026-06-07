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
  RECTANGLE: "rectangle",
  CENTER_HOLE: "center_hole",
  CORNER_BLOCKS: "corner_blocks"
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
  if (shapeType === SHAPE_TYPES.CENTER_HOLE) {
    return createCenterHole(rows, cols);
  }
  if (shapeType === SHAPE_TYPES.CORNER_BLOCKS) {
    return createCornerBlocks(rows, cols, rng);
  }
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

function createCenterHole(rows, cols) {
  const active = [];
  const holeRows = Math.max(2, Math.floor(rows * 0.24));
  const holeCols = Math.max(2, Math.floor(cols * 0.24));
  const rowStart = Math.floor((rows - holeRows) / 2);
  const rowEnd = rowStart + holeRows;
  const colStart = Math.floor((cols - holeCols) / 2);
  const colEnd = colStart + holeCols;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const inHole = row >= rowStart && row < rowEnd && col >= colStart && col < colEnd;
      if (!inHole) {
        active.push({ row, col, key: cellKey(row, col) });
      }
    }
  }

  return active;
}

function createCornerBlocks(rows, cols, rng) {
  const shapeActiveSet = new Set();
  const blockRows = Math.max(3, Math.floor(rows * 0.44));
  const blockCols = Math.max(3, Math.floor(cols * 0.44));
  const leftBridgeCol = blockCols - 1;
  const rightBridgeCol = cols - blockCols;
  const topBridgeRow = blockRows - 1;
  const bottomBridgeRow = rows - blockRows;

  addBlock(shapeActiveSet, 0, 0, blockRows, blockCols);
  addBlock(shapeActiveSet, 0, cols - blockCols, blockRows, cols);
  addBlock(shapeActiveSet, rows - blockRows, 0, rows, blockCols);
  addBlock(shapeActiveSet, rows - blockRows, cols - blockCols, rows, cols);

  for (let col = leftBridgeCol; col <= rightBridgeCol; col += 1) {
    shapeActiveSet.add(cellKey(topBridgeRow, col));
    shapeActiveSet.add(cellKey(bottomBridgeRow, col));
  }

  for (let row = topBridgeRow; row <= bottomBridgeRow; row += 1) {
    shapeActiveSet.add(cellKey(row, leftBridgeCol));
    shapeActiveSet.add(cellKey(row, rightBridgeCol));
  }

  return Array.from(shapeActiveSet).map((key) => ({ ...parseCellKey(key), key }));
}

function addBlock(shapeActiveSet, rowStart, colStart, rowEnd, colEnd) {
  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = colStart; col < colEnd; col += 1) {
      shapeActiveSet.add(cellKey(row, col));
    }
  }
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

  const flagChanged =
    actionType !== "flag" ||
    typeof action.flagged !== "boolean" ||
    typeof action.wasFlagged !== "boolean" ||
    action.flagged !== action.wasFlagged;
  next.movesUsed += actionType === "reveal" || (actionType === "flag" && flagChanged) ? 1 : 0;

  if (challengeConfig.mode === GAME_MODES.DETONATION) {
    if (actionType === "reveal" && action.isMine) {
      next.detonatedMines += 1;
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
    if (next.mineMistakes > challengeConfig.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challengeConfig.mode === GAME_MODES.TREASURE_HUNT) {
    if (next.treasureFound) {
      return { ...next, status: "won", reason: "找到宝藏" };
    }
    if (next.mineMistakes > challengeConfig.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challengeConfig.mode === GAME_MODES.DETONATION && next.detonatedMines >= challengeConfig.targetCount) {
    return { ...next, status: "won", reason: "引爆目标完成" };
  }

  if (challengeConfig.mode === GAME_MODES.FLAGS && next.correctFlags >= challengeConfig.targetCount) {
    return { ...next, status: "won", reason: "插旗目标完成" };
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
  if (challengeConfig.mode === GAME_MODES.FLAGS) {
    const remainingTargets = challengeConfig.targetCount - state.correctFlags;
    return remainingMoves < remainingTargets ? "剩余步数不足以完成插旗目标" : "";
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
  modeItem: document.getElementById("modeItem"),
  modeText: document.getElementById("modeText"),
  targetItem: document.getElementById("targetItem"),
  targetText: document.getElementById("targetText"),
  movesItem: document.getElementById("movesItem"),
  movesText: document.getElementById("movesText"),
  mistakeItem: document.getElementById("mistakeItem"),
  mistakeText: document.getElementById("mistakeText")
};

const params = new URLSearchParams(window.location.search);
const selectedDifficulty = params.get("difficulty");
const challengeId = params.get("challenge");

let config = DIFFICULTIES[selectedDifficulty] || DIFFICULTIES.beginner;
let challenge = null;
let minefield = null;
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

function normalizeChallenge(row) {
  return {
    id: row.id,
    title: row.title,
    challengeDate: row.challenge_date,
    slotIndex: row.slot_index,
    difficulty: row.difficulty,
    difficultyTier: row.difficulty_tier,
    mode: row.mode,
    rows: Number(row.rows),
    cols: Number(row.cols),
    mines: Number(row.mines),
    shapeType: row.shape_type,
    targetCount: Number(row.target_count || 0),
    moveLimit: row.move_limit === null ? null : Number(row.move_limit),
    mineMistakeLimit: Number(row.mine_mistake_limit || 0),
    seed: row.seed
  };
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
  const rng = createRng(challenge.seed);
  minefield = createMinefield(challenge, rng);
  activeSet = new Set(minefield.activeKeys);
  const cellsByKey = new Map(minefield.activeCells.map((cell) => [cell.key, cell]));

  board = Array.from({ length: challenge.rows }, (_, row) =>
    Array.from({ length: challenge.cols }, (_, col) => {
      const key = cellKey(row, col);
      const generated = cellsByKey.get(key);
      if (!generated) {
        return {
          row,
          col,
          key,
          isActive: false,
          isMine: false,
          adjacentMines: 0,
          isRevealed: false,
          isFlagged: false
        };
      }

      return {
        ...generated,
        isActive: true,
        isRevealed: false,
        isFlagged: false
      };
    })
  );

  treasureKey = challenge.mode === GAME_MODES.TREASURE_HUNT ? chooseTreasureKey() : null;
}

function chooseTreasureKey() {
  const rng = createRng(`${challenge.seed}:treasure`);
  const candidates = minefield.activeCells
    .filter((cell) => !cell.isMine && cell.key !== minefield.startKey)
    .sort((a, b) => b.adjacentMines - a.adjacentMines || a.key.localeCompare(b.key));
  const risky = candidates.filter((cell) => cell.adjacentMines >= 2);
  return seededShuffle(rng, risky.length ? risky : candidates)[0]?.key || minefield.startKey;
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
  elements.timer.textContent = "0";
  elements.board.innerHTML = "";
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
  elements.mineCounter.textContent = String(config.mines);
  elements.stateText.textContent = stateLabels[gameState];
  elements.difficultyLabel.textContent = `${config.label} · ${config.rows} x ${config.cols} · ${config.mines} 雷`;
  setChallengeStatsVisible(false);
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
    challenge = normalizeChallenge(row);
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
    }
    modeState = createModeState(challenge);
    gameState = "ready";
    elements.mineCounter.textContent = String(challenge.mines);
    elements.stateText.textContent = stateLabels[gameState];
    elements.difficultyLabel.textContent = buildChallengeHeading();
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

function renderBoard() {
  const fragment = document.createDocumentFragment();
  elements.board.style.gridTemplateColumns = `repeat(${config.cols}, var(--cell-size))`;

  for (const row of board) {
    for (const cell of row) {
      if (!cell.isActive) {
        const hole = document.createElement("div");
        hole.className = "cell inactive";
        hole.setAttribute("aria-hidden", "true");
        fragment.appendChild(hole);
        continue;
      }

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
}

function updateCell(cell, hitMine) {
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

    if (cell.isMine) {
      button.classList.add("mine");
      button.textContent = "💣";
      if (hitMine) {
        button.classList.add("hit");
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
  const cell = board[row] && board[row][col] ? board[row][col] : null;
  return cell && cell.isActive ? cell : null;
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
  return board.flat().filter((cell) => cell.isActive);
}

function revealCell(cell) {
  if (!cell || isGameOver() || cell.isRevealed || cell.isFlagged) {
    return;
  }

  if (challenge && challenge.mode === GAME_MODES.FLAGS) {
    toggleFlag(cell);
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
      updateCell(cell, true);
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

function isTreasureRevealed() {
  return treasureKey ? board.flat().some((item) => item.key === treasureKey && item.isRevealed) : false;
}

function revealSafeCell(cell) {
  if (cell.isRevealed || cell.isFlagged || cell.isMine || !cell.isActive) {
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
    if (visited.has(cell.key) || cell.isFlagged || cell.isRevealed || cell.isMine || !cell.isActive) {
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
  elements.mineCounter.textContent = String(config.mines - flagCount);
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
  revealMines(hitCell);
  revealTreasure();
  lockBoard();
  showResult(result);
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
      targetProgress: getChallengeProgressValue()
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

function updateChallengeStats() {
  if (!challenge || !modeState) {
    return;
  }

  elements.modeText.textContent = modeLabels[challenge.mode] || challenge.mode;
  elements.targetText.textContent = buildProgressText();
  elements.movesText.textContent = challenge.moveLimit
    ? `${Math.max(0, challenge.moveLimit - modeState.movesUsed)}/${challenge.moveLimit}`
    : "不限";
  elements.mistakeText.textContent = buildMistakeText();
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
    return `${modeState.correctFlags}/${challenge.targetCount}`;
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
    return `${modeState.wrongFlags} 错旗`;
  }
  if (challenge.mode === GAME_MODES.DETONATION) {
    return "不计";
  }
  return `${modeState.mineMistakes}/${challenge.mineMistakeLimit}`;
}

function startTimer() {
  stopTimer();
  timerId = window.setInterval(() => {
    elapsedSeconds += 1;
    elements.timer.textContent = String(elapsedSeconds);
  }, 1000);
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
elements.restartButton.addEventListener("click", initGame);
elements.playAgainButton.addEventListener("click", initGame);

initGame();
