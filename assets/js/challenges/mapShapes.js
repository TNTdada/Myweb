import { randomInt, shuffle } from "./rng.js";

export const SHAPE_TYPES = {
  RECTANGLE: "rectangle",
  CENTER_HOLE: "center_hole",
  CORNER_BLOCKS: "corner_blocks"
};

export function cellKey(row, col) {
  return `${row},${col}`;
}

export function parseCellKey(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

export function getNeighbors(cell, activeSet) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const row = cell.row + rowOffset;
      const col = cell.col + colOffset;
      const key = cellKey(row, col);

      if (activeSet.has(key)) {
        neighbors.push({ row, col, key });
      }
    }
  }

  return neighbors;
}

export function createActiveCells(shapeType, rows, cols, rng) {
  if (shapeType === SHAPE_TYPES.CENTER_HOLE) {
    return createCenterHole(rows, cols);
  }
  if (shapeType === SHAPE_TYPES.CORNER_BLOCKS) {
    return createCornerBlocks(rows, cols, rng);
  }
  return createRectangle(rows, cols);
}

export function createRectangle(rows, cols) {
  const active = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      active.push({ row, col, key: cellKey(row, col) });
    }
  }

  return active;
}

export function createCenterHole(rows, cols) {
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

export function createCornerBlocks(rows, cols, rng) {
  const activeSet = new Set();
  const blockRows = Math.max(3, Math.floor(rows * 0.44));
  const blockCols = Math.max(3, Math.floor(cols * 0.44));
  const bridgeRow = randomInt(rng, blockRows - 1, rows - blockRows);
  const bridgeCol = randomInt(rng, blockCols - 1, cols - blockCols);

  addBlock(activeSet, 0, 0, blockRows, blockCols);
  addBlock(activeSet, 0, cols - blockCols, blockRows, cols);
  addBlock(activeSet, rows - blockRows, 0, rows, blockCols);
  addBlock(activeSet, rows - blockRows, cols - blockCols, rows, cols);

  for (let col = blockCols - 1; col <= cols - blockCols; col += 1) {
    activeSet.add(cellKey(bridgeRow, col));
    activeSet.add(cellKey(Math.min(rows - 1, bridgeRow + 1), col));
  }

  for (let row = blockRows - 1; row <= rows - blockRows; row += 1) {
    activeSet.add(cellKey(row, bridgeCol));
    activeSet.add(cellKey(row, Math.min(cols - 1, bridgeCol + 1)));
  }

  return Array.from(activeSet).map((key) => ({ ...parseCellKey(key), key }));
}

function addBlock(activeSet, rowStart, colStart, rowEnd, colEnd) {
  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = colStart; col < colEnd; col += 1) {
      activeSet.add(cellKey(row, col));
    }
  }
}

export function isConnected(activeCells) {
  if (activeCells.length === 0) {
    return false;
  }

  const activeSet = new Set(activeCells.map((cell) => cell.key));
  const queue = [activeCells[0]];
  const visited = new Set([activeCells[0].key]);

  while (queue.length > 0) {
    const cell = queue.shift();
    for (const neighbor of getNeighbors(cell, activeSet)) {
      if (!visited.has(neighbor.key)) {
        visited.add(neighbor.key);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === activeCells.length;
}

export function chooseStartCell(rng, activeCells, activeSet) {
  const candidates = activeCells.filter((cell) => getNeighbors(cell, activeSet).length >= 5);
  return shuffle(rng, candidates.length ? candidates : activeCells)[0];
}

export function createMinefield(config, rng) {
  const activeCells = createActiveCells(config.shapeType, config.rows, config.cols, rng);
  const activeSet = new Set(activeCells.map((cell) => cell.key));

  if (!isConnected(activeCells)) {
    throw new Error("Generated map is not connected");
  }

  const startCell = chooseStartCell(rng, activeCells, activeSet);
  const protectedKeys = new Set([
    startCell.key,
    ...getNeighbors(startCell, activeSet).map((cell) => cell.key)
  ]);
  const mineCandidates = activeCells.filter((cell) => !protectedKeys.has(cell.key));
  const mines = new Set(shuffle(rng, mineCandidates).slice(0, config.mines).map((cell) => cell.key));

  const cells = activeCells.map((cell) => ({
    ...cell,
    isMine: mines.has(cell.key),
    adjacentMines: getNeighbors(cell, activeSet).filter((neighbor) => mines.has(neighbor.key)).length
  }));

  return {
    rows: config.rows,
    cols: config.cols,
    shapeType: config.shapeType,
    startKey: startCell.key,
    activeCells: cells,
    activeKeys: Array.from(activeSet),
    mineKeys: Array.from(mines)
  };
}
