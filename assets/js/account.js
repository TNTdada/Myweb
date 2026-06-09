(function () {
  "use strict";

  let accountButton = document.getElementById("accountButton");
  let accountPanel = document.getElementById("accountPanel");
  if (!accountButton) {
    createAccountWidget();
    accountButton = document.getElementById("accountButton");
    accountPanel = document.getElementById("accountPanel");
  }
  const panelName = document.getElementById("accountPanelName");
  const panelStatus = document.getElementById("accountPanelStatus");
  const signOutButton = document.getElementById("signOutButton");
  const miniGames = document.getElementById("miniGames");
  const miniWins = document.getElementById("miniWins");
  const miniBestScore = document.getElementById("miniBestScore");
  const miniTotalTime = document.getElementById("miniTotalTime");
  const miniLevel = document.getElementById("miniLevel");
  const miniXp = document.getElementById("miniXp");
  const miniXpBar = document.getElementById("miniXpBar");

  function createAccountWidget() {
    const widget = document.createElement("div");
    widget.className = "account-widget";
    widget.innerHTML = `
      <button class="account-button" id="accountButton" type="button">未登录</button>
      <section class="account-panel" id="accountPanel" hidden aria-label="账户数据面板">
        <div class="account-panel-heading">
          <strong id="accountPanelName">未登录</strong>
          <span id="accountPanelStatus">登录后记录游戏数据</span>
          <div class="xp-progress mini-xp-progress"><span id="miniXpBar"></span></div>
        </div>
        <dl class="mini-stats">
          <div><dt>游戏局数</dt><dd id="miniGames">0</dd></div>
          <div><dt>胜场</dt><dd id="miniWins">0</dd></div>
          <div><dt>最高分</dt><dd id="miniBestScore">0</dd></div>
          <div><dt>总时长</dt><dd id="miniTotalTime">0s</dd></div>
        </dl>
        <div class="account-actions">
          <a class="ghost-button" href="profile.html">详细信息</a>
          <button class="ghost-button" id="signOutButton" type="button">退出</button>
        </div>
      </section>`;
    document.body.append(widget);
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
    if (miniLevel) {
      miniLevel.textContent = "Lv.1";
    }
    if (miniXp) {
      miniXp.textContent = "0";
    }
    if (miniXpBar) {
      miniXpBar.style.width = "0%";
    }
    hidePanel();
  }

  async function renderSignedIn(user) {
    currentUser = user;
    const profile = await window.MywebSupabase.fetchProfile(user.id);
    const name = window.MywebSupabase.displayName(profile, user);
    const stats = await window.MywebSupabase.fetchGameStats(user.id);
    const xp = await window.MywebSupabase.fetchPlayerXpSummary(user.id);

    accountButton.textContent = window.MywebSupabase.truncateName(name, 8);
    panelName.textContent = name;
    panelStatus.textContent = xp.isReady
      ? `Lv.${xp.level} · ${xp.totalXp} XP`
      : `${stats.games} 局游戏 · 胜率 ${Math.round(stats.winRate * 100)}%`;
    miniGames.textContent = String(stats.games);
    miniWins.textContent = String(stats.wins);
    miniBestScore.textContent = String(stats.bestScore);
    miniTotalTime.textContent = formatDuration(stats.totalTime);
    if (miniLevel) {
      miniLevel.textContent = `Lv.${xp.level}`;
    }
    if (miniXp) {
      miniXp.textContent = String(xp.totalXp);
    }
    if (miniXpBar) {
      miniXpBar.style.width = `${Math.round((xp.currentLevelXp / xp.xpPerLevel) * 100)}%`;
    }
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
