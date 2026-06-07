(function () {
  "use strict";

  const ids = [
    "profileName", "profileUsername", "profileCreatedAt", "profileLastSignIn",
    "statGames", "statWins", "statWinRate", "statBestScore", "statAvgScore",
    "statTotalTime", "statAvgTime", "statBestTime", "statBeginner",
    "statIntermediate", "statExpert", "statLastPlayed", "profileMessage"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

  function setText(id, value) {
    elements[id].textContent = value;
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

  function formatDuration(seconds) {
    if (!seconds) {
      return "0s";
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
  }

  async function initProfile() {
    try {
      const user = await window.MywebSupabase.getCurrentUser();
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const profile = await window.MywebSupabase.fetchProfile(user.id);
      const stats = await window.MywebSupabase.fetchGameStats(user.id);
      const name = window.MywebSupabase.displayName(profile, user);

      setText("profileName", name);
      setText("profileUsername", profile && profile.username ? profile.username : "-");
      setText("profileCreatedAt", formatDate(profile ? profile.created_at : user.created_at));
      setText("profileLastSignIn", formatDate(user.last_sign_in_at));
      setText("statGames", String(stats.games));
      setText("statWins", String(stats.wins));
      setText("statWinRate", `${Math.round(stats.winRate * 100)}%`);
      setText("statBestScore", String(stats.bestScore));
      setText("statAvgScore", String(stats.avgScore));
      setText("statTotalTime", formatDuration(stats.totalTime));
      setText("statAvgTime", formatDuration(stats.avgTime));
      setText("statBestTime", stats.bestTime === null ? "-" : formatDuration(stats.bestTime));
      setText("statBeginner", String(stats.beginner));
      setText("statIntermediate", String(stats.intermediate));
      setText("statExpert", String(stats.expert));
      setText("statLastPlayed", formatDate(stats.lastPlayed));
      setText("profileMessage", "数据已更新");
    } catch (error) {
      setText("profileMessage", error.message || "数据读取失败");
    }
  }

  initProfile();
})();
