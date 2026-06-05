(function () {
  "use strict";

  const storageKey = "minefield-theme";
  const root = document.documentElement;

  function getInitialTheme() {
    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(storageKey, theme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const isDark = theme === "dark";
      button.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
      button.setAttribute("title", isDark ? "切换浅色模式" : "切换深色模式");
    });

    document.querySelectorAll("[data-theme-icon]").forEach((icon) => {
      icon.textContent = theme === "dark" ? "☀" : "☾";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getInitialTheme());

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
      });
    });
  });
})();
