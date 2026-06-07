(function () {
  "use strict";

  const modeLabels = {
    classic: "经典",
    taps: "点开",
    treasure_hunt: "寻宝",
    detonation: "引爆",
    flags: "插旗"
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
    grid: document.getElementById("dailyGrid"),
    message: document.getElementById("dailyMessage"),
    dateLabel: document.getElementById("dailyDateLabel"),
    prev: document.getElementById("prevDayButton"),
    next: document.getElementById("nextDayButton"),
    today: document.getElementById("todayButton")
  };

  let selectedDate = localDateString(new Date());
  const todayDate = localDateString(new Date());

  function setMessage(value) {
    elements.message.textContent = value;
  }

  function buildErrorMessage(error) {
    const friendly = window.MywebSupabase && typeof window.MywebSupabase.friendlyError === "function"
      ? window.MywebSupabase.friendlyError(error, "每日挑战读取失败")
      : "每日挑战读取失败";
    const detail = error && (error.code || error.message)
      ? `（${error.code || error.message}）`
      : "";
    return `${friendly}${detail}`;
  }

  function localDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return localDateString(date);
  }

  function formatDate(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    });
  }

  function renderChallenges(challenges) {
    elements.grid.innerHTML = "";

    if (challenges.length === 0) {
      setMessage("这一天暂时没有已发布的挑战。");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const challenge of challenges) {
      fragment.appendChild(createChallengeCard(challenge));
    }

    elements.grid.appendChild(fragment);
    setMessage("挑战数据已更新。");
  }

  function createChallengeCard(challenge) {
    const card = document.createElement("article");
    card.className = "challenge-card";

    const title = document.createElement("h2");
    title.textContent = challenge.title || `${tierLabels[challenge.difficulty_tier] || "每日"}${modeLabels[challenge.mode] || "挑战"}`;

    const meta = document.createElement("p");
    meta.className = "challenge-meta";
    meta.textContent = `${modeLabels[challenge.mode] || challenge.mode} · ${tierLabels[challenge.difficulty_tier] || challenge.difficulty_tier} · ${challenge.rows} x ${challenge.cols}`;

    const details = document.createElement("dl");
    details.className = "challenge-details";
    details.append(
      detailItem("雷数", challenge.mines),
      detailItem("目标", buildTargetText(challenge)),
      detailItem("步数", challenge.move_limit === null ? "不限" : challenge.move_limit),
      detailItem("地图", shapeLabels[challenge.shape_type] || challenge.shape_type)
    );

    const action = document.createElement("a");
    action.className = "ghost-button";
    action.href = `game.html?challenge=${encodeURIComponent(challenge.id)}`;
    action.textContent = "开始挑战";

    card.append(title, meta, details, action);
    return card;
  }

  function detailItem(label, value) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = String(value);
    wrapper.append(term, description);
    return wrapper;
  }

  function buildTargetText(challenge) {
    if (challenge.mode === "detonation") {
      return `引爆 ${challenge.target_count}`;
    }
    if (challenge.mode === "flags") {
      return `正确插旗 ${challenge.target_count}`;
    }
    if (challenge.mode === "treasure_hunt") {
      return "找到宝藏";
    }
    return `翻开 ${challenge.target_count}`;
  }

  async function loadChallenges() {
    try {
      elements.dateLabel.textContent = formatDate(selectedDate);
      setMessage("正在读取每日挑战");
      let challenges = await window.MywebSupabase.fetchDailyChallenges(selectedDate);

      if (challenges.length === 0 && selectedDate === todayDate) {
        const fallback = await findLatestPublishedChallenges(todayDate);
        if (fallback) {
          selectedDate = fallback.date;
          challenges = fallback.challenges;
          elements.dateLabel.textContent = formatDate(selectedDate);
          renderChallenges(challenges);
          setMessage(`今天的挑战尚未发布，已显示 ${formatDate(selectedDate)} 的最近挑战。`);
          return;
        }
      }

      renderChallenges(challenges);
    } catch (error) {
      console.error("Daily challenge load failed:", error);
      elements.grid.innerHTML = "";
      setMessage(buildErrorMessage(error));
    }
  }

  async function findLatestPublishedChallenges(fromDate) {
    for (let offset = 1; offset <= 30; offset += 1) {
      const date = addDays(fromDate, -offset);
      try {
        const challenges = await window.MywebSupabase.fetchDailyChallenges(date);
        if (challenges.length > 0) {
          return { date, challenges };
        }
      } catch (error) {
        console.warn("Daily fallback lookup failed:", date, error);
      }
    }

    return null;
  }

  elements.prev.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, -1);
    loadChallenges();
  });

  elements.next.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, 1);
    loadChallenges();
  });

  elements.today.addEventListener("click", () => {
    selectedDate = localDateString(new Date());
    loadChallenges();
  });

  loadChallenges();
})();
