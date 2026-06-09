(function () {
  "use strict";

  const elements = {
    profileName: document.getElementById("profileName"),
    profileUsername: document.getElementById("profileUsername"),
    profileCreatedAt: document.getElementById("profileCreatedAt"),
    profileLastSignIn: document.getElementById("profileLastSignIn"),
    statLevel: document.getElementById("statLevel"),
    statTotalXp: document.getElementById("statTotalXp"),
    statLevelProgress: document.getElementById("statLevelProgress"),
    statXpToNext: document.getElementById("statXpToNext"),
    profileXpBar: document.getElementById("profileXpBar"),
    statsCategories: document.getElementById("statsCategories"),
    profileMessage: document.getElementById("profileMessage")
  };

  const difficultyLabels = {
    beginner: "初级 9x9",
    intermediate: "中等 16x16",
    expert: "高级 30x16"
  };

  const categoryThemes = ["classic", "beginner", "intermediate", "expert", "daily"];

  function setText(id, value) {
    if (elements[id]) {
      elements[id].textContent = value;
    }
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

  function formatDuration(seconds) {
    const total = Number(seconds || 0);
    if (total <= 0) {
      return "0s";
    }
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
  }

  function percent(wins, games) {
    return games ? `${Math.round((wins / games) * 100)}%` : "0%";
  }

  function summarizeRows(rows) {
    const games = rows.length;
    const wins = rows.filter((row) => row.won || row.completed).length;
    const totalTime = rows.reduce((sum, row) => sum + Number(row.elapsed_seconds || 0), 0);
    const winningTimes = rows
      .filter((row) => row.won || row.completed)
      .map((row) => Number(row.best_time || row.elapsed_seconds || 0))
      .filter((value) => value > 0);

    return {
      games,
      wins,
      winRate: percent(wins, games),
      bestScore: games ? Math.max(...rows.map((row) => Number(row.score || 0))) : 0,
      totalTime,
      bestTime: winningTimes.length ? Math.min(...winningTimes) : null,
      lastPlayed: rows[0] ? rows[0].created_at || rows[0].completed_at : null
    };
  }

  function buildClassicFavorite(rows) {
    if (rows.length === 0) {
      return "-";
    }
    const counts = rows.reduce((map, row) => {
      const key = row.difficulty || "beginner";
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());
    const [key, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return `${difficultyLabels[key] || key} · ${count}`;
  }

  function renderCategoryCard(title, summary, extraRows, themeIndex) {
    const card = document.createElement("article");
    card.className = `stat-category-card theme-${categoryThemes[themeIndex] || "classic"}`;
    const heading = document.createElement("h2");
    heading.textContent = title;
    const list = document.createElement("dl");
    list.append(
      statRow("总用时", formatDuration(summary.totalTime)),
      statRow("高分", String(summary.bestScore)),
      statRow("最佳通关时间", summary.bestTime === null ? "-" : formatDuration(summary.bestTime)),
      statRow("已玩游戏", String(summary.games)),
      statRow("获胜的游戏", String(summary.wins)),
      statRow("获胜率", summary.winRate),
      ...extraRows
    );
    card.append(heading, list);
    return card;
  }

  function statRow(label, value) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    return wrapper;
  }

  function renderStats(gameRows, dailyRows) {
    const cards = [];
    const classicSummary = summarizeRows(gameRows);
    cards.push(renderCategoryCard("🌐 经典（所有难度）", classicSummary, [
      statRow("最喜欢的游戏", buildClassicFavorite(gameRows)),
      statRow("最近游玩", formatDate(classicSummary.lastPlayed))
    ], 0));

    for (const [index, key] of ["beginner", "intermediate", "expert"].entries()) {
      const rows = gameRows.filter((row) => row.difficulty === key);
      const summary = summarizeRows(rows);
      cards.push(renderCategoryCard(difficultyLabels[key], summary, [
        statRow("最长连胜", "-"),
        statRow("当前连胜", "-")
      ], index + 1));
    }

    const dailySummary = summarizeRows(dailyRows);
    const completedDays = new Set(
      dailyRows
        .filter((row) => row.completed || row.won)
        .map((row) => row.challenge_date || (row.created_at ? row.created_at.slice(0, 10) : ""))
        .filter(Boolean)
    ).size;
    cards.push(renderCategoryCard("✅ 每日挑战", dailySummary, [
      statRow("完成的天数", String(completedDays)),
      statRow("挑战已开始", String(dailySummary.games))
    ], 4));

    elements.statsCategories.innerHTML = "";
    elements.statsCategories.append(...cards);
  }

  async function initProfile() {
    try {
      const user = await window.MywebSupabase.getCurrentUser();
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const [profile, stats, xp, dailyRows] = await Promise.all([
        window.MywebSupabase.fetchProfile(user.id),
        window.MywebSupabase.fetchGameStats(user.id),
        window.MywebSupabase.fetchPlayerXpSummary(user.id),
        window.MywebSupabase.fetchDailyResultRows(user.id)
      ]);
      const name = window.MywebSupabase.displayName(profile, user);
      const progressPercent = Math.max(0, Math.min(100, Math.round((xp.currentLevelXp / xp.xpPerLevel) * 100)));

      setText("profileName", name);
      setText("profileUsername", profile && profile.username ? profile.username : "-");
      setText("profileCreatedAt", formatDate(profile ? profile.created_at : user.created_at));
      setText("profileLastSignIn", formatDate(user.last_sign_in_at));
      setText("statLevel", `Lv.${xp.level}`);
      setText("statTotalXp", `总 XP ${xp.totalXp}`);
      setText("statLevelProgress", `${xp.currentLevelXp}/${xp.xpPerLevel} XP`);
      setText("statXpToNext", String(xp.xpToNextLevel));
      if (elements.profileXpBar) {
        elements.profileXpBar.style.width = `${progressPercent}%`;
      }
      renderStats(stats.rows || [], dailyRows || []);
      setText("profileMessage", "数据已更新");
    } catch (error) {
      setText("profileMessage", window.MywebSupabase.friendlyError(error, "数据读取失败"));
    }
  }

  initProfile();
})();
