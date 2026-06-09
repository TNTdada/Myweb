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

  const elements = {
    grid: document.getElementById("dailyGrid"),
    message: document.getElementById("dailyMessage"),
    dateLabel: document.getElementById("dailyDateLabel"),
    dateButton: document.getElementById("dailyDateButton"),
    calendarPanel: document.getElementById("calendarPanel"),
    prev: document.getElementById("prevDayButton"),
    next: document.getElementById("nextDayButton"),
    today: document.getElementById("todayButton")
  };

  const params = new URLSearchParams(window.location.search);
  const storedDate = window.localStorage.getItem("myweb:lastDailyDate");
  let selectedDate = normalizeDate(params.get("date")) || normalizeDate(storedDate) || localDateString(new Date());
  const todayDate = localDateString(new Date());
  let calendarMonth = selectedDate.slice(0, 7);
  const calendarCache = new Map();
  const tooltip = createTooltip();

  function modeInfoFor(mode) {
    const shared = window.MywebModeInfo && window.MywebModeInfo[mode];
    return shared || {
      icon: "",
      label: modeLabels[mode] || mode || "挑战",
      rule: "按照当前模式目标完成挑战。"
    };
  }

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

  function normalizeDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
  }

  function rememberSelectedDate() {
    window.localStorage.setItem("myweb:lastDailyDate", selectedDate);
    const url = new URL(window.location.href);
    url.searchParams.set("date", selectedDate);
    window.history.replaceState({}, "", url);
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

  function renderChallenges(challenges, progressByChallenge = new Map()) {
    elements.grid.innerHTML = "";

    if (challenges.length === 0) {
      setMessage("这一天暂时没有已发布的挑战。");
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const challenge of challenges) {
      fragment.appendChild(createChallengeCard(challenge, progressByChallenge.get(challenge.id)));
    }

    elements.grid.appendChild(fragment);
    setMessage("挑战数据已更新。");
  }

  function createChallengeCard(challenge, progress) {
    const card = document.createElement("article");
    card.className = "challenge-card";
    if (isTimeChallenge(challenge)) {
      card.classList.add("is-timed");
    }
    if (progress && (progress.completed || progress.won)) {
      card.classList.add("is-completed");
    }

    const info = modeInfoFor(challenge.mode);
    const title = document.createElement("h2");
    title.className = "mode-title";
    const titleText = document.createElement("span");
    const icon = document.createElement("span");
    icon.className = "mode-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = info.icon;
    titleText.append(icon, document.createTextNode(challenge.title || `${tierLabels[challenge.difficulty_tier] || "每日"}${info.label || "挑战"}`));
    const help = document.createElement("button");
    help.type = "button";
    help.className = "info-dot";
    help.textContent = "!";
    help.dataset.tooltip = info.rule;
    help.title = info.rule;
    help.setAttribute("aria-label", `${info.label}规则：${info.rule}`);
    attachTooltip(help);
    title.append(titleText, help);

    const meta = document.createElement("p");
    meta.className = "challenge-meta";
    meta.textContent = `${info.label || modeLabels[challenge.mode] || challenge.mode} · ${tierLabels[challenge.difficulty_tier] || challenge.difficulty_tier}${isTimeChallenge(challenge) ? " · 时间挑战赛" : ""}`;

    const details = document.createElement("dl");
    details.className = "challenge-details";
    details.append(
      detailItem("XP", buildXpText(challenge)),
      detailItem("状态", buildProgressText(progress))
    );

    const action = document.createElement("a");
    action.className = "ghost-button";
    action.href = `game.html?challenge=${encodeURIComponent(challenge.id)}`;
    action.textContent = progress && (progress.completed || progress.won) ? "再次挑战" : "开始挑战";
    action.addEventListener("click", () => rememberSelectedDate());

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

  function isTimeChallenge(challenge) {
    if (challenge.time_limit_enabled === true) {
      return true;
    }
    if (typeof challenge.time_limit_enabled === "string" && challenge.time_limit_enabled.toLowerCase() === "true") {
      return true;
    }
    if (challenge.extra_rules && typeof challenge.extra_rules === "object") {
      return Boolean(challenge.extra_rules.timeLimitEnabled);
    }
    return false;
  }

  function buildXpText(challenge) {
    if (typeof challenge.xp_reward === "number") {
      return `${challenge.xp_reward} XP`;
    }
    const fallback = {
      easy: 250,
      medium: 500,
      hard: 1500
    };
    return `${fallback[challenge.difficulty_tier] || 0} XP`;
  }

  function buildProgressText(progress) {
    if (!progress) {
      return "未完成";
    }
    if (progress.xp_claimed) {
      return "已完成";
    }
    if (progress.completed || progress.won) {
      return "已完成";
    }
    return "进行中";
  }

  async function loadChallenges() {
    try {
      elements.dateLabel.textContent = formatDate(selectedDate);
      rememberSelectedDate();
      setMessage("正在读取每日挑战");
      let challenges = await window.MywebSupabase.fetchDailyChallenges(selectedDate);

      renderChallenges(challenges, await loadProgress(challenges));
      calendarCache.delete(calendarMonth);
    } catch (error) {
      console.error("Daily challenge load failed:", error);
      elements.grid.innerHTML = "";
      setMessage(buildErrorMessage(error));
    }
  }

  async function loadProgress(challenges) {
    if (!window.MywebSupabase || typeof window.MywebSupabase.fetchDailyProgress !== "function") {
      return new Map();
    }
    try {
      return await window.MywebSupabase.fetchDailyProgress(challenges.map((challenge) => challenge.id));
    } catch (error) {
      console.warn("Daily progress lookup failed:", error);
      return new Map();
    }
  }

  elements.prev.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, -1);
    calendarMonth = selectedDate.slice(0, 7);
    loadChallenges();
  });

  elements.next.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, 1);
    calendarMonth = selectedDate.slice(0, 7);
    loadChallenges();
  });

  elements.today.addEventListener("click", () => {
    selectedDate = localDateString(new Date());
    calendarMonth = selectedDate.slice(0, 7);
    loadChallenges();
  });

  elements.dateButton.addEventListener("click", async () => {
    elements.calendarPanel.hidden = !elements.calendarPanel.hidden;
    if (!elements.calendarPanel.hidden) {
      await renderCalendar();
    }
  });

  document.addEventListener("click", (event) => {
    if (
      !elements.calendarPanel.hidden &&
      !elements.calendarPanel.contains(event.target) &&
      !elements.dateButton.contains(event.target)
    ) {
      elements.calendarPanel.hidden = true;
    }
  });

  function createTooltip() {
    const element = document.createElement("div");
    element.className = "floating-tooltip";
    element.hidden = true;
    document.body.appendChild(element);
    return element;
  }

  function attachTooltip(button) {
    const show = () => {
      tooltip.textContent = button.dataset.tooltip || "";
      const rect = button.getBoundingClientRect();
      tooltip.hidden = false;
      const left = Math.min(window.innerWidth - 16, Math.max(16, rect.left + rect.width / 2));
      const top = Math.max(12, rect.top - tooltip.offsetHeight - 10);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
    button.addEventListener("mouseleave", hide);
    button.addEventListener("blur", hide);
  }

  async function renderCalendar() {
    elements.calendarPanel.innerHTML = "";
    const monthData = await loadCalendarMonth(calendarMonth);
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leading = firstDay.getDay();

    const header = document.createElement("div");
    header.className = "calendar-header";
    const prevMonth = document.createElement("button");
    prevMonth.type = "button";
    prevMonth.className = "calendar-nav";
    prevMonth.textContent = "‹";
    const title = document.createElement("strong");
    title.textContent = `${year}年${month}月`;
    const nextMonth = document.createElement("button");
    nextMonth.type = "button";
    nextMonth.className = "calendar-nav";
    nextMonth.textContent = "›";
    header.append(prevMonth, title, nextMonth);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";
    for (const weekday of ["日", "一", "二", "三", "四", "五", "六"]) {
      const label = document.createElement("span");
      label.className = "calendar-weekday";
      label.textContent = weekday;
      grid.appendChild(label);
    }
    for (let index = 0; index < leading; index += 1) {
      grid.appendChild(document.createElement("span"));
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const status = monthData.get(date);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.textContent = String(day);
      button.disabled = !status;
      if (status) {
        button.classList.add("has-challenge");
      }
      if (status && status.completed) {
        button.classList.add("is-completed");
      }
      if (date === selectedDate) {
        button.classList.add("is-selected");
      }
      button.addEventListener("click", () => {
        selectedDate = date;
        calendarMonth = selectedDate.slice(0, 7);
        elements.calendarPanel.hidden = true;
        loadChallenges();
      });
      grid.appendChild(button);
    }

    prevMonth.addEventListener("click", async () => {
      calendarMonth = addMonths(calendarMonth, -1);
      await renderCalendar();
    });
    nextMonth.addEventListener("click", async () => {
      calendarMonth = addMonths(calendarMonth, 1);
      await renderCalendar();
    });

    elements.calendarPanel.append(header, grid);
  }

  async function loadCalendarMonth(monthString) {
    if (calendarCache.has(monthString)) {
      return calendarCache.get(monthString);
    }

    try {
      const map = await window.MywebSupabase.fetchDailyChallengeDates(`${monthString}-01`);
      calendarCache.set(monthString, map);
      return map;
    } catch (error) {
      console.warn("Calendar lookup failed:", error);
      const empty = new Map();
      calendarCache.set(monthString, empty);
      return empty;
    }
  }

  function addMonths(monthString, offset) {
    const [year, month] = monthString.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  loadChallenges();
})();
