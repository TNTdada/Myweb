(function () {
  "use strict";

  const elements = {
    username: document.getElementById("loginUsernameInput"),
    password: document.getElementById("loginPasswordInput"),
    message: document.getElementById("loginMessage"),
    signIn: document.getElementById("signInButton")
  };

  let supabase = null;
  let failedSignInCount = Number(localStorage.getItem("minefield-login-failures") || "0");
  let cooldownUntil = Number(localStorage.getItem("minefield-login-cooldown") || "0");
  let isSubmitting = false;

  function setMessage(value) {
    elements.message.textContent = value;
  }

  function isUsername(value) {
    return /^[A-Za-z0-9_]{3,20}$/.test(value);
  }

  function getForm() {
    return {
      username: elements.username.value.trim(),
      password: elements.password.value
    };
  }

  function validate(form) {
    if (!form.username || !form.password) {
      return "账户名和密码不能为空";
    }
    if (!isUsername(form.username)) {
      return "账户名只能使用 3-20 位字母、数字或下划线";
    }
    if (!window.mywebCaptchaToken) {
      return "请先完成验证码验证";
    }
    return "";
  }

  function resetCaptcha() {
    window.mywebCaptchaToken = "";
    if (window.turnstile && typeof window.turnstile.reset === "function") {
      window.turnstile.reset();
    }
  }

  async function signIn() {
    if (isSubmitting) {
      return;
    }

    const now = Date.now();
    if (now < cooldownUntil) {
      setMessage(`失败次数过多，请 ${Math.ceil((cooldownUntil - now) / 1000)} 秒后再试`);
      return;
    }

    const form = getForm();
    const message = validate(form);
    if (message) {
      setMessage(message);
      return;
    }

    isSubmitting = true;
    elements.signIn.disabled = true;
    setMessage("正在登录");
    const { error } = await supabase.auth.signInWithPassword({
      email: window.MywebSupabase.authEmailFromUsername(form.username),
      password: form.password,
      options: {
        captchaToken: window.mywebCaptchaToken
      }
    });

    if (error) {
      failedSignInCount += 1;
      localStorage.setItem("minefield-login-failures", String(failedSignInCount));
      if (failedSignInCount >= 5) {
        cooldownUntil = Date.now() + 60 * 1000;
        failedSignInCount = 0;
        localStorage.setItem("minefield-login-failures", "0");
        localStorage.setItem("minefield-login-cooldown", String(cooldownUntil));
        setMessage("连续登录失败过多，请 1 分钟后再试");
        resetCaptcha();
        isSubmitting = false;
        elements.signIn.disabled = false;
        return;
      }
      setMessage(`登录失败：${window.MywebSupabase.friendlyError(error, "请检查账户名或密码")}`);
      resetCaptcha();
      isSubmitting = false;
      elements.signIn.disabled = false;
      return;
    }

    localStorage.setItem("minefield-login-failures", "0");
    localStorage.setItem("minefield-login-cooldown", "0");
    setMessage("登录成功，正在返回首页");
    const redirect = sanitizeRedirect(new URLSearchParams(window.location.search).get("redirect"));
    window.location.href = redirect || "index.html";
  }

  function sanitizeRedirect(value) {
    if (!value || value.includes(":") || value.startsWith("/") || value.includes("\\")) {
      return "";
    }
    return value;
  }

  async function init() {
    try {
      supabase = window.MywebSupabase.getClient();
      const user = await window.MywebSupabase.getCurrentUser();
      if (user) {
        setMessage("当前已登录，可返回首页");
      }
    } catch (error) {
      setMessage(window.MywebSupabase.friendlyError(error, "账户状态读取失败"));
    }
  }

  elements.signIn.addEventListener("click", signIn);
  init();
})();
