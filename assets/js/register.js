(function () {
  "use strict";

  const elements = {
    username: document.getElementById("usernameInput"),
    nickname: document.getElementById("nicknameInput"),
    password: document.getElementById("passwordInput"),
    passwordConfirm: document.getElementById("passwordConfirmInput"),
    message: document.getElementById("authMessage"),
    signUp: document.getElementById("signUpButton")
  };

  let supabase = null;
  let isSubmitting = false;

  function setMessage(value) {
    elements.message.textContent = value;
  }

  function getForm() {
    return {
      username: elements.username.value.trim(),
      nickname: elements.nickname.value.trim(),
      password: elements.password.value,
      passwordConfirm: elements.passwordConfirm.value
    };
  }

  function isUsername(value) {
    return /^[A-Za-z0-9_]{3,20}$/.test(value);
  }

  function validateSignUp(form) {
    if (!form.username || !form.nickname || !form.password || !form.passwordConfirm) {
      return "账户名、昵称、密码和确认密码不能为空";
    }
    if (!isUsername(form.username)) {
      return "账户名只能使用 3-20 位字母、数字或下划线";
    }
    if (form.password.length < 6) {
      return "密码至少需要 6 位";
    }
    if (form.password !== form.passwordConfirm) {
      return "两次输入的密码不一致";
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

  async function saveProfile(user, form) {
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        username: window.MywebSupabase.normalizeUsername(form.username),
        nickname: form.nickname
      }, { onConflict: "user_id" });

    if (error) {
      throw error;
    }
  }

  async function signUp() {
    if (isSubmitting) {
      return;
    }

    const form = getForm();
    const message = validateSignUp(form);
    if (message) {
      setMessage(message);
      return;
    }

    isSubmitting = true;
    elements.signUp.disabled = true;
    setMessage("正在注册");
    const { data, error } = await supabase.auth.signUp({
      email: window.MywebSupabase.authEmailFromUsername(form.username),
      password: form.password,
      options: {
        captchaToken: window.mywebCaptchaToken,
        data: {
          username: window.MywebSupabase.normalizeUsername(form.username),
          nickname: form.nickname
        }
      }
    });

    if (error) {
      setMessage(`注册失败：${window.MywebSupabase.friendlyError(error, "请检查注册信息后重试")}`);
      resetCaptcha();
      isSubmitting = false;
      elements.signUp.disabled = false;
      return;
    }

    if (data.session && data.user) {
      try {
        await saveProfile(data.user, form);
        setMessage("注册成功，正在返回首页");
        window.location.href = "index.html";
      } catch (profileError) {
        setMessage(`账号已创建，但资料保存失败：${window.MywebSupabase.friendlyError(profileError, "请稍后登录后修改资料")}`);
        resetCaptcha();
        isSubmitting = false;
        elements.signUp.disabled = false;
      }
      return;
    }

    setMessage("注册成功，请返回登录页登录");
    resetCaptcha();
    isSubmitting = false;
    elements.signUp.disabled = false;
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

  elements.signUp.addEventListener("click", signUp);
  init();
})();
