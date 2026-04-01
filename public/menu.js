(function () {
  const STORAGE_KEY = "travel-dashboard-theme";
  const DATA_KEY = "travel-dashboard-data";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function readTheme() {
    return localStorage.getItem(STORAGE_KEY) || "light";
  }

  function updateJourneyLink() {
    const link = document.getElementById("journey-details-link");
    if (!link) {
      return;
    }

    const hasData = Boolean(sessionStorage.getItem(DATA_KEY));
    link.classList.toggle("is-disabled", !hasData);
    link.setAttribute("aria-disabled", String(!hasData));
    if (!hasData && link.getAttribute("href") === "/details.html") {
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(readTheme());

    const menuButton = document.getElementById("menu-button");
    const menuPanel = document.getElementById("menu-panel");
    const themeToggle = document.getElementById("theme-toggle");
    const detailsLink = document.getElementById("journey-details-link");

    updateJourneyLink();

    if (menuButton && menuPanel) {
      menuButton.addEventListener("click", () => {
        const isHidden = menuPanel.classList.toggle("is-hidden");
        menuButton.setAttribute("aria-expanded", String(!isHidden));
      });

      document.addEventListener("click", (event) => {
        if (!menuPanel.contains(event.target) && !menuButton.contains(event.target)) {
          menuPanel.classList.add("is-hidden");
          menuButton.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        const nextTheme = readTheme() === "dark" ? "light" : "dark";
        localStorage.setItem(STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
      });
    }

    if (detailsLink) {
      detailsLink.addEventListener("click", (event) => {
        if (detailsLink.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
        }
      });
    }

    window.addEventListener("storage", updateJourneyLink);
  });
})();
