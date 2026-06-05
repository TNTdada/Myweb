(function () {
  "use strict";

  const DIFFICULTIES = {
    beginner: { label: "初级", rows: 9, cols: 9, mines: 10, multiplier: 1 },
    intermediate: { label: "中级", rows: 16, cols: 16, mines: 40, multiplier: 1.5 },
    expert: { label: "高级", rows: 16, cols: 30, mines: 99, multiplier: 2 }
  };

  const stateLabels = {
    ready: "准备中",
    playing: "游戏中",
    won: "胜利",
    lost: "失败"
  };

  const elements = {
    board: document.getElementById("board"),
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
    playAgainButton: document.getElementById("playAgainButton")
  };

  const params = new URLSearchParams(window.location.search);
  const selectedDifficulty = params.get("difficulty");
  const config = DIFFICULTIES[selectedDifficulty] || DIFFICULTIES.beginner;

  let board = [];
  let gameState = "ready";
  let revealedSafeCells = 0;
  let flagCount = 0;
  let elapsedSeconds = 0;
  let timerId = null;
  let longPressTimer = null;
  let longPressTriggered = false;

  function createEmptyBoard() {
    board = Array.from({ length: config.rows }, (_, row) =>
      Array.from({ length: config.cols }, (_, col) => ({
        row,
        col,
        isMine: false,
        adjacentMines: 0,
        isRevealed: false,
        isFlagged: false
      }))
    );
  }

  function initGame() {
    stopTimer();
    createEmptyBoard();
    gameState = "ready";
    revealedSafeCells = 0;
    flagCount = 0;
    elapsedSeconds = 0;
    elements.timer.textContent = "0";
    elements.mineCounter.textContent = String(config.mines);
    elements.stateText.textContent = stateLabels[gameState];
    elements.difficultyLabel.textContent = `${config.label} · ${config.rows} x ${config.cols} · ${config.mines} 雷`;
    elements.board.style.gridTemplateColumns = `repeat(${config.cols}, var(--cell-size))`;
    elements.board.innerHTML = "";
    if (elements.resultDialog.open) {
      elements.resultDialog.close();
    }
    renderBoard();
  }

  function renderBoard() {
    const fragment = document.createDocumentFragment();

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
      } else if (cell.adjacentMines > 0) {
        button.textContent = String(cell.adjacentMines);
        button.classList.add(`n${cell.adjacentMines}`);
      }
      return;
    }

    button.disabled = gameState === "won" || gameState === "lost";
    if (cell.isFlagged) {
      button.classList.add("flagged");
      button.textContent = "🚩";
    }
  }

  function buildCellLabel(cell) {
    if (cell.isRevealed && cell.isMine) {
      return "地雷";
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
    const target = event.target.closest(".cell");
    if (!target || !elements.board.contains(target)) {
      return null;
    }

    const row = Number(target.dataset.row);
    const col = Number(target.dataset.col);
    return board[row] && board[row][col] ? board[row][col] : null;
  }

  function startGame(firstCell) {
    placeMines(firstCell);
    calculateNumbers();
    gameState = "playing";
    elements.stateText.textContent = stateLabels[gameState];
    startTimer();
  }

  function placeMines(firstCell) {
    const protectedCells = new Set(
      getNeighbors(firstCell.row, firstCell.col)
        .concat(firstCell)
        .map((cell) => `${cell.row},${cell.col}`)
    );

    const candidates = [];
    const fallbackCandidates = [];
    for (const row of board) {
      for (const cell of row) {
        fallbackCandidates.push(cell);
        if (!protectedCells.has(`${cell.row},${cell.col}`)) {
          candidates.push(cell);
        }
      }
    }

    const pool = candidates.length >= config.mines ? candidates : fallbackCandidates.filter((cell) => cell !== firstCell);
    shuffle(pool);

    for (let index = 0; index < config.mines; index += 1) {
      pool[index].isMine = true;
    }
  }

  function calculateNumbers() {
    for (const row of board) {
      for (const cell of row) {
        cell.adjacentMines = getNeighbors(cell.row, cell.col).filter((neighbor) => neighbor.isMine).length;
      }
    }
  }

  function getNeighbors(row, col) {
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

  function revealCell(cell) {
    if (!cell || gameState === "won" || gameState === "lost" || cell.isRevealed || cell.isFlagged) {
      return;
    }

    if (gameState === "ready") {
      startGame(cell);
    }

    if (cell.isMine) {
      cell.isRevealed = true;
      updateCell(cell, true);
      endGame("lost", cell);
      return;
    }

    if (cell.adjacentMines === 0) {
      revealEmptyArea(cell);
    } else {
      revealSafeCell(cell);
    }

    checkWin();
  }

  function revealSafeCell(cell) {
    if (cell.isRevealed || cell.isFlagged || cell.isMine) {
      return;
    }

    cell.isRevealed = true;
    revealedSafeCells += 1;
    updateCell(cell);
  }

  function revealEmptyArea(startCell) {
    const queue = [startCell];
    const visited = new Set();

    while (queue.length > 0) {
      const cell = queue.shift();
      const key = `${cell.row},${cell.col}`;
      if (visited.has(key) || cell.isFlagged || cell.isRevealed || cell.isMine) {
        continue;
      }

      visited.add(key);
      revealSafeCell(cell);

      if (cell.adjacentMines === 0) {
        for (const neighbor of getNeighbors(cell.row, cell.col)) {
          if (!neighbor.isMine && !neighbor.isFlagged && !neighbor.isRevealed) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  function toggleFlag(cell) {
    if (!cell || gameState === "won" || gameState === "lost" || cell.isRevealed) {
      return;
    }

    cell.isFlagged = !cell.isFlagged;
    flagCount += cell.isFlagged ? 1 : -1;
    elements.mineCounter.textContent = String(config.mines - flagCount);
    updateCell(cell);
  }

  function checkWin() {
    if (revealedSafeCells === config.rows * config.cols - config.mines) {
      endGame("won");
    }
  }

  function endGame(result, hitCell) {
    gameState = result;
    stopTimer();
    elements.stateText.textContent = stateLabels[gameState];
    revealMines(hitCell);
    lockBoard();
    showResult(result);
  }

  function revealMines(hitCell) {
    for (const row of board) {
      for (const cell of row) {
        if (cell.isMine) {
          cell.isRevealed = true;
          updateCell(cell, cell === hitCell);
        }
      }
    }
  }

  function lockBoard() {
    elements.board.querySelectorAll(".cell").forEach((button) => {
      button.disabled = true;
    });
  }

  function showResult(result) {
    const score = calculateScore(result);
    elements.resultState.textContent = result === "won" ? "Clear" : "Game Over";
    elements.resultTitle.textContent = result === "won" ? "恭喜通关" : "踩到地雷";
    elements.finalScore.textContent = String(score);
    elements.finalTime.textContent = String(elapsedSeconds);
    elements.safeCells.textContent = `${revealedSafeCells}/${config.rows * config.cols - config.mines}`;
    elements.resultDialog.showModal();
  }

  function calculateScore(result) {
    const correctFlags = board.flat().filter((cell) => cell.isMine && cell.isFlagged).length;
    const winBonus = result === "won" ? config.mines * 20 : 0;
    const baseScore = revealedSafeCells * 10 + correctFlags * 5 - elapsedSeconds * 2 + winBonus;
    return Math.max(0, Math.round(baseScore * config.multiplier));
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

  elements.board.addEventListener("click", (event) => {
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }
    revealCell(getCellFromEvent(event));
  });

  elements.board.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (longPressTriggered) {
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
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      toggleFlag(cell);
    }, 520);
  });

  elements.board.addEventListener("pointerup", () => {
    window.clearTimeout(longPressTimer);
  });

  elements.board.addEventListener("pointercancel", () => {
    window.clearTimeout(longPressTimer);
  });

  elements.restartButton.addEventListener("click", initGame);
  elements.playAgainButton.addEventListener("click", initGame);

  initGame();
})();
