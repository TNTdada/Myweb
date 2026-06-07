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

  function friendlyError(error, fallback) {
    if (!error) {
      return fallback || "操作失败，请稍后再试";
    }

    const code = String(error.code || error.error_code || "");
    const status = String(error.status || "");
    const message = String(error.message || error.msg || "").toLowerCase();

    if (code === "captcha_failed" || message.includes("captcha")) {
      return "验证码验证失败，请重新完成验证";
    }
    if (code === "user_already_exists" || message.includes("already registered") || message.includes("already exists")) {
      return "该账户名已被注册，请换一个账户名";
    }
    if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
      return "账户名或密码不正确";
    }
    if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
      return "账号尚未完成验证，请稍后再试";
    }
    if (code === "weak_password" || message.includes("weak password") || message.includes("password should")) {
      return "密码强度不足，请设置更安全的密码";
    }
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || status === "429" || message.includes("rate limit")) {
      return "操作过于频繁，请稍后再试";
    }
    if (code === "23505" || message.includes("duplicate key")) {
      return "该账户名已被使用，请换一个账户名";
    }
    if (code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
      return "当前没有权限完成该操作，请重新登录后再试";
    }
    if (message.includes("failed to fetch") || message.includes("network") || message.includes("load failed")) {
      return "网络连接失败，请检查网络后重试";
    }
    if (message.includes("invalid") && message.includes("password")) {
      return "密码格式不符合要求";
    }

    return fallback || "操作失败，请稍后再试";
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

  async function fetchDailyChallenges(dateString) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("daily_challenges")
      .select("id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published")
      .eq("challenge_date", dateString)
      .eq("is_published", true)
      .order("slot_index", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchDailyChallengeById(id) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("daily_challenges")
      .select("id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("挑战不存在或尚未发布");
    }

    return data;
  }

  async function saveDailyResult(result) {
    const supabase = getClient();
    const user = await getCurrentUser();
    if (!user) {
      return { saved: false, reason: "not_signed_in" };
    }

    const row = {
      user_id: user.id,
      challenge_id: result.challenge.id,
      mode: result.challenge.mode,
      difficulty_tier: result.challenge.difficultyTier,
      score: Number(result.score || 0),
      won: Boolean(result.won),
      elapsed_seconds: Number(result.elapsedSeconds || 0),
      moves_used: Number(result.movesUsed || 0),
      target_progress: Number(result.targetProgress || 0),
      completed_at: new Date().toISOString()
    };

    const { data: existing, error: readError } = await supabase
      .from("daily_results")
      .select("id, score, won, elapsed_seconds")
      .eq("user_id", user.id)
      .eq("challenge_id", result.challenge.id)
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    if (existing) {
      const shouldUpdate =
        row.score > Number(existing.score || 0) ||
        (row.score === Number(existing.score || 0) && row.won && !existing.won) ||
        (row.score === Number(existing.score || 0) && row.won === existing.won && row.elapsed_seconds < Number(existing.elapsed_seconds || Infinity));

      if (!shouldUpdate) {
        return { saved: false, reason: "existing_result_is_better" };
      }

      const { error: updateError } = await supabase
        .from("daily_results")
        .update(row)
        .eq("id", existing.id);

      if (updateError) {
        throw updateError;
      }
      return { saved: true, reason: "updated" };
    }

    const { error: insertError } = await supabase.from("daily_results").insert(row);
    if (insertError) {
      throw insertError;
    }

    return { saved: true, reason: "inserted" };
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
    friendlyError,
    fetchProfile,
    fetchGameStats,
    fetchDailyChallenges,
    fetchDailyChallengeById,
    saveDailyResult
  };
})();
