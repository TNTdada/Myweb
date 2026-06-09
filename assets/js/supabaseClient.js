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

  function calculateLevel(totalXp) {
    const xp = Math.max(0, Number(totalXp || 0));
    const xpPerLevel = 3000;
    const level = Math.floor(xp / xpPerLevel) + 1;
    const currentLevelXp = xp % xpPerLevel;

    return {
      totalXp: xp,
      level,
      currentLevelXp,
      xpToNextLevel: xpPerLevel - currentLevelXp,
      xpPerLevel
    };
  }

  async function fetchPlayerXpSummary(userId) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("total_xp")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (error.code === "42703" || error.code === "PGRST204" || String(error.message || "").includes("total_xp")) {
        return { ...calculateLevel(0), isReady: false };
      }
      throw error;
    }

    return { ...calculateLevel(data ? data.total_xp : 0), isReady: true };
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
    const columns = "id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published, xp_reward, lives, time_limit_enabled, time_limit_seconds, initial_reveal_count, initial_reveal_type, extra_rules";
    let { data, error } = await supabase
      .from("daily_challenges")
      .select(columns)
      .eq("challenge_date", dateString)
      .eq("is_published", true)
      .order("slot_index", { ascending: true });

    if (error && isMissingDailyXpColumn(error)) {
      const fallback = await supabase
        .from("daily_challenges")
        .select("id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published")
        .eq("challenge_date", dateString)
        .eq("is_published", true)
        .order("slot_index", { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchDailyChallengeById(id) {
    const supabase = getClient();
    const columns = "id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published, xp_reward, lives, time_limit_enabled, time_limit_seconds, initial_reveal_count, initial_reveal_type, extra_rules";
    let { data, error } = await supabase
      .from("daily_challenges")
      .select(columns)
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();

    if (error && isMissingDailyXpColumn(error)) {
      const fallback = await supabase
        .from("daily_challenges")
        .select("id, challenge_date, slot_index, title, difficulty, difficulty_tier, mode, rows, cols, mines, shape_type, target_count, move_limit, mine_mistake_limit, seed, is_published")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("挑战不存在或尚未发布");
    }

    return data;
  }

  function isMissingDailyXpColumn(error) {
    const message = String(error && error.message || "");
    return error && (error.code === "42703" || error.code === "PGRST204" || /xp_reward|lives|time_limit_enabled|time_limit_seconds|initial_reveal|extra_rules/.test(message));
  }

  async function fetchDailyProgress(challengeIds) {
    if (!challengeIds || challengeIds.length === 0) {
      return new Map();
    }

    const supabase = getClient();
    const user = await getCurrentUser();
    if (!user) {
      return new Map();
    }

    let { data, error } = await supabase
      .from("daily_results")
      .select("challenge_id, completed, xp_claimed, won, score, elapsed_seconds, attempts, best_time")
      .eq("user_id", user.id)
      .in("challenge_id", challengeIds);

    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      const fallback = await supabase
        .from("daily_results")
        .select("challenge_id, won, score, elapsed_seconds")
        .eq("user_id", user.id)
        .in("challenge_id", challengeIds);
      data = (fallback.data || []).map((row) => ({
        ...row,
        completed: Boolean(row.won),
        xp_claimed: false,
        attempts: 1,
        best_time: row.elapsed_seconds
      }));
      error = fallback.error;
    }

    if (error) {
      console.warn("Daily progress was not loaded:", error);
      return new Map();
    }

    return new Map((data || []).map((row) => [row.challenge_id, row]));
  }

  async function fetchDailyChallengeDates(monthDateString) {
    const supabase = getClient();
    const date = new Date(`${monthDateString}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startString = `${year}-${String(month).padStart(2, "0")}-01`;
    const endString = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("daily_challenges")
      .select("id, challenge_date")
      .gte("challenge_date", startString)
      .lte("challenge_date", endString)
      .eq("is_published", true);

    if (error) {
      throw error;
    }

    const byDate = new Map();
    for (const row of data || []) {
      const key = row.challenge_date;
      if (!byDate.has(key)) {
        byDate.set(key, []);
      }
      byDate.get(key).push(row.id);
    }

    const user = await getCurrentUser();
    if (!user) {
      return new Map(Array.from(byDate, ([key, ids]) => [key, { ids, completed: false }]));
    }

    const allIds = Array.from(byDate.values()).flat();
    if (allIds.length === 0) {
      return new Map();
    }

    const progress = await fetchDailyProgress(allIds);
    return new Map(Array.from(byDate, ([key, ids]) => [
      key,
      {
        ids,
        completed: ids.length > 0 && ids.every((id) => {
          const item = progress.get(id);
          return item && (item.completed || item.won);
        })
      }
    ]));
  }

  async function fetchDailyResultRows(userId) {
    const supabase = getClient();
    let { data, error } = await supabase
      .from("daily_results")
      .select("challenge_id, challenge_date, challenge_mode, challenge_difficulty_tier, mode, difficulty_tier, score, won, completed, elapsed_seconds, target_progress, attempts, best_time, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      const fallback = await supabase
        .from("daily_results")
        .select("challenge_id, mode, difficulty_tier, score, won, elapsed_seconds, target_progress, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return [];
      }
      throw error;
    }

    return data || [];
  }

  async function saveDailyResult(result) {
    const supabase = getClient();
    const user = await getCurrentUser();
    if (!user) {
      return { saved: false, reason: "not_signed_in" };
    }

    if (typeof supabase.rpc === "function") {
      const rpcResult = await supabase.rpc("complete_daily_challenge", {
        p_challenge_id: result.challenge.id,
        p_score: Number(result.score || 0),
        p_won: Boolean(result.won),
        p_elapsed_seconds: Number(result.elapsedSeconds || 0),
        p_moves_used: Number(result.movesUsed || 0),
        p_target_progress: Number(result.targetProgress || 0),
        p_session_config: result.sessionConfig || {}
      });

      if (!rpcResult.error) {
        return { saved: true, reason: "rpc", data: rpcResult.data };
      }

      if (rpcResult.error.code === "42883" || rpcResult.error.code === "PGRST202") {
        const legacyRpcResult = await supabase.rpc("complete_daily_challenge", {
          p_challenge_id: result.challenge.id,
          p_score: Number(result.score || 0),
          p_won: Boolean(result.won),
          p_elapsed_seconds: Number(result.elapsedSeconds || 0),
          p_moves_used: Number(result.movesUsed || 0),
          p_target_progress: Number(result.targetProgress || 0)
        });

        if (!legacyRpcResult.error) {
          return { saved: true, reason: "legacy_rpc", data: legacyRpcResult.data };
        }

        if (legacyRpcResult.error.code !== "42883" && legacyRpcResult.error.code !== "PGRST202") {
          throw legacyRpcResult.error;
        }
      }

      if (rpcResult.error.code !== "42883" && rpcResult.error.code !== "PGRST202") {
        console.warn("Daily result RPC failed, falling back to direct save:", rpcResult.error);
      }
    }

    const row = {
      user_id: user.id,
      challenge_id: result.challenge.id,
      mode: result.challenge.mode,
      difficulty_tier: result.challenge.difficultyTier,
      challenge_date: result.challenge.challengeDate,
      slot_index: result.challenge.slotIndex,
      challenge_title: result.challenge.title,
      challenge_mode: result.challenge.mode,
      challenge_difficulty_tier: result.challenge.difficultyTier,
      challenge_xp_reward: result.challenge.xpReward,
      score: Number(result.score || 0),
      won: Boolean(result.won),
      completed: Boolean(result.won),
      elapsed_seconds: Number(result.elapsedSeconds || 0),
      moves_used: Number(result.movesUsed || 0),
      target_progress: Number(result.targetProgress || 0),
      session_config: result.sessionConfig || {},
      result_version: 2,
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
        if (isMissingDailyResultColumn(updateError)) {
          return updateLegacyDailyResult(supabase, existing.id, row);
        }
        throw updateError;
      }
      return { saved: true, reason: "updated" };
    }

    const { error: insertError } = await supabase.from("daily_results").insert(row);
    if (insertError) {
      if (isMissingDailyResultColumn(insertError)) {
        return insertLegacyDailyResult(supabase, row);
      }
      throw insertError;
    }

    return { saved: true, reason: "inserted" };
  }

  async function submitFeedback({ contactEmail, message, pageUrl }) {
    const supabase = getClient();
    const user = await getCurrentUser();
    if (!user) {
      return { saved: false, reason: "not_signed_in" };
    }

    const content = String(message || "").trim();
    if (!content) {
      throw new Error("请填写留言内容");
    }
    if (content.length > 800) {
      throw new Error("留言内容不能超过 800 字");
    }

    const email = String(contactEmail || "").trim();
    const { error } = await supabase.from("feedback_messages").insert({
      user_id: user.id,
      contact_email: email || null,
      message: content,
      page_url: pageUrl || window.location.href,
      user_agent: navigator.userAgent,
      status: "new"
    });

    if (error) {
      throw error;
    }

    return { saved: true };
  }

  function isMissingDailyResultColumn(error) {
    const message = String(error && error.message || "");
    return error && (error.code === "42703" || error.code === "PGRST204" || /completed|xp_claimed|attempts|best_time|lives_remaining|session_config/.test(message));
  }

  async function updateLegacyDailyResult(supabase, id, row) {
    const { error } = await supabase
      .from("daily_results")
      .update({
        score: row.score,
        won: row.won,
        elapsed_seconds: row.elapsed_seconds,
        moves_used: row.moves_used,
        target_progress: row.target_progress,
        completed_at: row.completed_at
      })
      .eq("id", id);

    if (error) {
      throw error;
    }
    return { saved: true, reason: "legacy_updated" };
  }

  async function insertLegacyDailyResult(supabase, row) {
    const { error } = await supabase.from("daily_results").insert({
      user_id: row.user_id,
      challenge_id: row.challenge_id,
      mode: row.mode,
      difficulty_tier: row.difficulty_tier,
      score: row.score,
      won: row.won,
      elapsed_seconds: row.elapsed_seconds,
      moves_used: row.moves_used,
      target_progress: row.target_progress,
      completed_at: row.completed_at
    });

    if (error) {
      throw error;
    }
    return { saved: true, reason: "legacy_inserted" };
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
    calculateLevel,
    fetchProfile,
    fetchPlayerXpSummary,
    fetchGameStats,
    fetchDailyChallenges,
    fetchDailyChallengeById,
    fetchDailyProgress,
    fetchDailyChallengeDates,
    fetchDailyResultRows,
    saveDailyResult,
    submitFeedback
  };
})();
