(function () {
  "use strict";

  const accountButton = document.getElementById("accountButton");
  const accountPanel = document.getElementById("accountPanel");
  const panelName = document.getElementById("accountPanelName");
  const panelStatus = document.getElementById("accountPanelStatus");
  const signOutButton = document.getElementById("signOutButton");
  const miniGames = document.getElementById("miniGames");
  const miniWins = document.getElementById("miniWins");
  const miniBestScore = document.getElementById("miniBestScore");
  const miniTotalTime = document.getElementById("miniTotalTime");

  if (!accountButton) {
    return;
  }

  let supabase = null;
  let currentUser = null;

  function formatDuration(seconds) {
    if (!seconds) {
      return "0s";
    }
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
  }

  function hidePanel() {
    accountPanel.hidden = true;
  }

  function showPanel() {
    accountPanel.hidden = false;
  }

  function renderSignedOut() {
    currentUser = null;
    accountButton.textContent = "未登录";
    panelName.textContent = "未登录";
    panelStatus.textContent = "登录后记录游戏数据";
    miniGames.textContent = "0";
    miniWins.textContent = "0";
    miniBestScore.textContent = "0";
    miniTotalTime.textContent = "0s";
    hidePanel();
  }

  async function renderSignedIn(user) {
    currentUser = user;
    const profile = await window.MywebSupabase.fetchProfile(user.id);
    const name = window.MywebSupabase.displayName(profile, user);
    const stats = await window.MywebSupabase.fetchGameStats(user.id);

    accountButton.textContent = window.MywebSupabase.truncateName(name, 8);
    panelName.textContent = name;
    panelStatus.textContent = `${stats.games} 局游戏 · 胜率 ${Math.round(stats.winRate * 100)}%`;
    miniGames.textContent = String(stats.games);
    miniWins.textContent = String(stats.wins);
    miniBestScore.textContent = String(stats.bestScore);
    miniTotalTime.textContent = formatDuration(stats.totalTime);
  }

  async function initAccount() {
    try {
      supabase = window.MywebSupabase.getClient();
      const user = await window.MywebSupabase.getCurrentUser();
      if (user) {
        await renderSignedIn(user);
      } else {
        renderSignedOut();
      }
    } catch (error) {
      renderSignedOut();
      panelStatus.textContent = window.MywebSupabase.friendlyError(error, "账户状态读取失败");
    }
  }

  accountButton.addEventListener("click", () => {
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }
    if (accountPanel.hidden) {
      showPanel();
    } else {
      hidePanel();
    }
  });

  document.addEventListener("click", (event) => {
    if (!accountPanel.hidden && !event.target.closest(".account-widget")) {
      hidePanel();
    }
  });

  signOutButton.addEventListener("click", async () => {
    if (!window.confirm("确定要退出登录吗？")) {
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      panelStatus.textContent = window.MywebSupabase.friendlyError(error, "退出失败，请稍后再试");
      return;
    }
    renderSignedOut();
  });

  initAccount();
})();
