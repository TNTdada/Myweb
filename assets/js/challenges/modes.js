export const GAME_MODES = {
  CLASSIC: "classic",
  TAPS: "taps",
  TREASURE_HUNT: "treasure_hunt",
  DETONATION: "detonation",
  FLAGS: "flags"
};

export const MODE_DEFINITIONS = {
  [GAME_MODES.CLASSIC]: {
    label: "经典",
    summary: "清除指定数量安全格，允许少量踩雷容错。",
    allowedActions: ["reveal", "flag"],
    successMetric: "revealedSafe"
  },
  [GAME_MODES.TAPS]: {
    label: "点开",
    summary: "不能插旗，在踩雷容错内翻开目标数量格子。",
    allowedActions: ["reveal"],
    successMetric: "revealedSafe"
  },
  [GAME_MODES.TREASURE_HUNT]: {
    label: "寻宝",
    summary: "找到隐藏在高风险数字格附近的宝藏格。",
    allowedActions: ["reveal", "flag"],
    successMetric: "treasureFound"
  },
  [GAME_MODES.DETONATION]: {
    label: "引爆",
    summary: "主动点击地雷，在步数内引爆目标数量。",
    allowedActions: ["reveal"],
    successMetric: "detonatedMines"
  },
  [GAME_MODES.FLAGS]: {
    label: "插旗",
    summary: "只能插旗，正确标记目标数量地雷。",
    allowedActions: ["flag"],
    successMetric: "correctFlags"
  }
};

export function createModeState(challenge) {
  return {
    mode: challenge.mode,
    movesUsed: 0,
    livesRemaining: typeof challenge.lives === "number" ? challenge.lives : null,
    mineMistakes: 0,
    revealedSafe: 0,
    detonatedMines: 0,
    correctFlags: 0,
    wrongFlags: 0,
    treasureFound: false,
    status: "playing"
  };
}

export function applyModeAction(challenge, state, action) {
  if (state.status !== "playing") {
    return state;
  }

  const next = { ...state };
  const actionType = action.type;
  const definition = MODE_DEFINITIONS[challenge.mode];

  if (!definition.allowedActions.includes(actionType)) {
    return { ...next, status: "failed", reason: "该模式不允许此操作" };
  }

  next.movesUsed += actionType === "reveal" ? 1 : 0;

  if (challenge.mode === GAME_MODES.DETONATION) {
    if (actionType === "reveal" && action.isMine) {
      next.detonatedMines += 1;
    } else if (actionType === "reveal") {
      next.mineMistakes += 1;
      if (typeof next.livesRemaining === "number") {
        next.livesRemaining -= 1;
      }
    }
  } else if (challenge.mode === GAME_MODES.FLAGS) {
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
    if (challenge.mode === GAME_MODES.TREASURE_HUNT && action.isTreasure) {
      next.treasureFound = true;
    }
  }

  return evaluateModeState(challenge, next);
}

export function evaluateModeState(challenge, state) {
  const next = { ...state };

  if (challenge.mode === GAME_MODES.CLASSIC || challenge.mode === GAME_MODES.TAPS) {
    if (next.revealedSafe >= challenge.targetCount) {
      return { ...next, status: "won", reason: "目标完成" };
    }
    if (typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
      return { ...next, status: "failed", reason: "生命值已耗尽" };
    }
    if (next.mineMistakes > challenge.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challenge.mode === GAME_MODES.TREASURE_HUNT) {
    if (next.treasureFound) {
      return { ...next, status: "won", reason: "找到宝藏" };
    }
    if (typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
      return { ...next, status: "failed", reason: "生命值已耗尽" };
    }
    if (next.mineMistakes > challenge.mineMistakeLimit) {
      return { ...next, status: "failed", reason: "踩雷次数超过限制" };
    }
  }

  if (challenge.mode === GAME_MODES.DETONATION && typeof next.livesRemaining === "number" && next.livesRemaining <= 0) {
    return { ...next, status: "failed", reason: "机会已用完" };
  }

  if (challenge.mode === GAME_MODES.DETONATION && next.detonatedMines >= challenge.targetCount) {
    return { ...next, status: "won", reason: "引爆目标完成" };
  }

  if (challenge.mode === GAME_MODES.FLAGS && next.correctFlags >= challenge.targetCount && next.wrongFlags === 0) {
    return { ...next, status: "won", reason: "插旗目标完成" };
  }

  const impossibleReason = getImpossibleReason(challenge, next);
  if (impossibleReason) {
    return { ...next, status: "failed", reason: impossibleReason };
  }

  if (challenge.moveLimit && next.movesUsed >= challenge.moveLimit) {
    return { ...next, status: "failed", reason: "步数已用完" };
  }

  return next;
}

function getImpossibleReason(challenge, state) {
  if (!challenge.moveLimit) {
    return "";
  }

  const remainingMoves = challenge.moveLimit - state.movesUsed;
  if (challenge.mode === GAME_MODES.DETONATION) {
    const remainingTargets = challenge.targetCount - state.detonatedMines;
    return remainingMoves < remainingTargets ? "剩余步数不足以完成引爆目标" : "";
  }
  return "";
}

export function calculateChallengeScore(challenge, state, elapsedSeconds) {
  const modeBonus = state.status === "won" ? 500 : 0;
  const progress = Math.max(
    state.revealedSafe,
    state.detonatedMines,
    state.correctFlags,
    state.treasureFound ? challenge.targetCount : 0
  );
  const movePenalty = state.movesUsed * 3;
  const timePenalty = Math.floor(elapsedSeconds / 2);
  const mistakePenalty = (state.mineMistakes + state.wrongFlags) * 25;

  return Math.max(0, modeBonus + progress * 20 - movePenalty - timePenalty - mistakePenalty);
}
