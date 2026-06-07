(function () {
  "use strict";

  const elements = {
    username: document.getElementById("editUsernameInput"),
    nickname: document.getElementById("editNicknameInput"),
    password: document.getElementById("editPasswordInput"),
    passwordConfirm: document.getElementById("editPasswordConfirmInput"),
    message: document.getElementById("editProfileMessage"),
    save: document.getElementById("saveProfileButton")
  };

  let supabase = null;
  let currentUser = null;

  function setMessage(value) {
    elements.message.textContent = value;
  }

  function getForm() {
    return {
      nickname: elements.nickname.value.trim(),
      password: elements.password.value,
      passwordConfirm: elements.passwordConfirm.value
    };
  }

  function validate(form) {
    if (!form.nickname) {
      return "昵称不能为空";
    }
    if (form.password || form.passwordConfirm) {
      if (form.password.length < 6) {
        return "新密码至少需要 6 位";
      }
      if (form.password !== form.passwordConfirm) {
        return "两次输入的新密码不一致";
      }
    }
    return "";
  }

  async function saveChanges() {
    const form = getForm();
    const message = validate(form);
    if (message) {
      setMessage(message);
      return;
    }

    setMessage("正在保存");
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ nickname: form.nickname })
      .eq("user_id", currentUser.id);

    if (profileError) {
      setMessage(`昵称保存失败：${window.MywebSupabase.friendlyError(profileError, "请稍后再试")}`);
      return;
    }

    if (form.password) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: form.password
      });

      if (passwordError) {
        setMessage(`昵称已保存，但密码修改失败：${window.MywebSupabase.friendlyError(passwordError, "请检查新密码后重试")}`);
        return;
      }
    }

    elements.password.value = "";
    elements.passwordConfirm.value = "";
    setMessage("信息已更新");
  }

  async function init() {
    try {
      supabase = window.MywebSupabase.getClient();
      currentUser = await window.MywebSupabase.getCurrentUser();
      if (!currentUser) {
        window.location.href = "login.html";
        return;
      }

      const profile = await window.MywebSupabase.fetchProfile(currentUser.id);
      elements.username.value = profile && profile.username ? profile.username : "-";
      elements.nickname.value = window.MywebSupabase.displayName(profile, currentUser);
      setMessage("可以修改昵称，或填写新密码后保存。");
    } catch (error) {
      setMessage(window.MywebSupabase.friendlyError(error, "账户信息读取失败"));
    }
  }

  elements.save.addEventListener("click", saveChanges);
  init();
})();
