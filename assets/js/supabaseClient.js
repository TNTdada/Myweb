(function () {
  "use strict";

  const SUPABASE_URL = "https://jgjxihliwinkrecmfwrc.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Nnv8xDocUJw333dahTpIcA_GaK612uK";

  let client = null;

  function getClient() {
    if (client) {
      return client;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase SDK 未加载");
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return client;
  }

  async function getCurrentUser() {
    const supabase = getClient();
    const sessionResult = await supabase.auth.getSession();

    if (sessionResult.error) {
      throw sessionResult.error;
    }

    return sessionResult.data.session ? sessionResult.data.session.user : null;
  }

  function displayName(profile, user) {
    if (profile && profile.nickname) {
      return profile.nickname;
    }
    if (profile && profile.username) {
      return profile.username;
    }
    return user && user.email ? user.email.split("@")[0] : "玩家";
  }

  function truncateName(name, maxLength) {
    if (!name) {
      return "未登录";
    }
    if (name.length <= maxLength) {
      return name;
    }
    return `${name.slice(0, maxLength)}...`;
  }

  function normalizeUsername(username) {
    return username.trim().toLowerCase();
  }

  function authEmailFromUsername(username) {
    return `${normalizeUsername(username)}@myweb.local`;
  }

  async function fetchProfile(userId) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, nickname, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async function fetchGameStats(userId) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("game_results")
      .select("difficulty, score, won, elapsed_seconds, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        console.warn("game_results table is not ready yet:", error.message);
        return buildGameStats([]);
      }
      throw error;
    }

    return buildGameStats(data || []);
  }

  function buildGameStats(rows) {
    const games = rows.length;
    const wins = rows.filter((row) => row.won).length;
    const totalScore = rows.reduce((sum, row) => sum + Number(row.score || 0), 0);
    const totalTime = rows.reduce((sum, row) => sum + Number(row.elapsed_seconds || 0), 0);
    const winningTimes = rows.filter((row) => row.won).map((row) => Number(row.elapsed_seconds || 0));

    return {
      rows,
      games,
      wins,
      losses: games - wins,
      winRate: games ? wins / games : 0,
      bestScore: games ? Math.max(...rows.map((row) => Number(row.score || 0))) : 0,
      avgScore: games ? Math.round(totalScore / games) : 0,
      totalTime,
      avgTime: games ? Math.round(totalTime / games) : 0,
      bestTime: winningTimes.length ? Math.min(...winningTimes) : null,
      beginner: rows.filter((row) => row.difficulty === "beginner").length,
      intermediate: rows.filter((row) => row.difficulty === "intermediate").length,
      expert: rows.filter((row) => row.difficulty === "expert").length,
      lastPlayed: rows[0] ? rows[0].created_at : null
    };
  }

  window.MywebSupabase = {
    getClient,
    getCurrentUser,
    displayName,
    truncateName,
    normalizeUsername,
    authEmailFromUsername,
    fetchProfile,
    fetchGameStats
  };
})();
