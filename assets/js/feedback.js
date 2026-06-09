(function () {
  "use strict";

  const maxLength = 800;

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) {
      element.className = options.className;
    }
    if (options.textContent) {
      element.textContent = options.textContent;
    }
    return element;
  }

  function currentUrlForRedirect() {
    const path = `${window.location.pathname.split("/").pop() || "index.html"}${window.location.search || ""}${window.location.hash || ""}`;
    return encodeURIComponent(path);
  }

  function buildFeedbackDialog() {
    const dialog = createElement("dialog", { className: "feedback-dialog" });
    dialog.id = "feedbackDialog";

    const content = createElement("form", { className: "feedback-content" });
    content.method = "dialog";

    const heading = createElement("div", { className: "feedback-heading" });
    const eyebrow = createElement("p", { className: "eyebrow", textContent: "Feedback" });
    const title = createElement("h2", { textContent: "留言反馈" });
    const copy = createElement("p", {
      textContent: "欢迎留下你在游玩、账号、每日挑战或界面体验中遇到的问题与建议。"
    });
    heading.append(eyebrow, title, copy);

    const emailLabel = createElement("label", { className: "form-field" });
    const emailText = createElement("span", { textContent: "联系方式（可选）" });
    const emailInput = document.createElement("input");
    emailInput.id = "feedbackEmailInput";
    emailInput.type = "email";
    emailInput.maxLength = 120;
    emailInput.placeholder = "方便回复你的邮箱，可留空";
    emailLabel.append(emailText, emailInput);

    const messageLabel = createElement("label", { className: "form-field" });
    const messageTop = createElement("span", { textContent: "留言内容" });
    const messageInput = document.createElement("textarea");
    messageInput.id = "feedbackMessageInput";
    messageInput.maxLength = maxLength;
    messageInput.rows = 8;
    messageInput.required = true;
    messageInput.placeholder = "请描述问题、建议或你希望改进的地方";
    messageLabel.append(messageTop, messageInput);

    const meta = createElement("div", { className: "feedback-meta" });
    const message = createElement("p", { className: "form-message", textContent: "留言内容不能为空。" });
    message.id = "feedbackStatus";
    const counter = createElement("span", { textContent: `0/${maxLength}` });
    counter.id = "feedbackCounter";
    meta.append(message, counter);

    const actions = createElement("div", { className: "feedback-actions" });
    const submit = createElement("button", { className: "primary-button", textContent: "提交反馈" });
    submit.type = "button";
    submit.id = "feedbackSubmitButton";
    const close = createElement("button", { className: "ghost-button", textContent: "取消" });
    close.type = "button";
    close.id = "feedbackCloseButton";
    actions.append(submit, close);

    content.append(heading, emailLabel, messageLabel, meta, actions);
    dialog.append(content);
    document.body.append(dialog);

    return { dialog, emailInput, messageInput, message, counter, submit, close };
  }

  async function initFeedback() {
    if (!window.MywebSupabase) {
      return;
    }

    const button = createElement("button", { className: "feedback-button" });
    button.type = "button";
    button.id = "feedbackButton";
    button.title = "留言反馈";
    button.setAttribute("aria-label", "留言反馈");
    button.textContent = "✉";
    document.body.append(button);

    const controls = buildFeedbackDialog();

    function setStatus(text, isError) {
      controls.message.textContent = text;
      controls.message.classList.toggle("is-error", Boolean(isError));
    }

    controls.messageInput.addEventListener("input", () => {
      controls.counter.textContent = `${controls.messageInput.value.length}/${maxLength}`;
      if (controls.messageInput.value.trim()) {
        setStatus("填写完成后即可提交。", false);
      } else {
        setStatus("留言内容不能为空。", false);
      }
    });

    button.addEventListener("click", async () => {
      try {
        const user = await window.MywebSupabase.getCurrentUser();
        if (!user) {
          window.location.href = `login.html?redirect=${currentUrlForRedirect()}`;
          return;
        }
        setStatus("填写完成后即可提交。", false);
        controls.dialog.showModal();
      } catch (error) {
        window.location.href = `login.html?redirect=${currentUrlForRedirect()}`;
      }
    });

    controls.close.addEventListener("click", () => {
      controls.dialog.close();
    });

    controls.dialog.addEventListener("click", (event) => {
      if (event.target === controls.dialog) {
        controls.dialog.close();
      }
    });

    controls.submit.addEventListener("click", async () => {
      const content = controls.messageInput.value.trim();
      if (!content) {
        setStatus("请先填写留言内容。", true);
        controls.messageInput.focus();
        return;
      }
      if (content.length > maxLength) {
        setStatus(`留言内容不能超过 ${maxLength} 字。`, true);
        return;
      }

      controls.submit.disabled = true;
      setStatus("正在提交反馈...", false);

      try {
        await window.MywebSupabase.submitFeedback({
          contactEmail: controls.emailInput.value,
          message: content,
          pageUrl: window.location.href
        });
        controls.messageInput.value = "";
        controls.emailInput.value = "";
        controls.counter.textContent = `0/${maxLength}`;
        setStatus("反馈已提交，感谢你的建议。", false);
        window.setTimeout(() => controls.dialog.close(), 900);
      } catch (error) {
        console.warn("Feedback submit failed:", error);
        setStatus(window.MywebSupabase.friendlyError(error, "反馈提交失败，请稍后再试"), true);
      } finally {
        controls.submit.disabled = false;
      }
    });
  }

  window.addEventListener("DOMContentLoaded", initFeedback);
})();
