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
    const tabLink = document.querySelector(".mobile-details-tab");
    if (!link && !tabLink) {
      return;
    }

    const hasData = Boolean(sessionStorage.getItem(DATA_KEY));
    const hasLocalData = Boolean(localStorage.getItem(DATA_KEY));
    const enabled = hasData || hasLocalData;
    if (link) {
      link.classList.toggle("is-disabled", !enabled);
      link.setAttribute("aria-disabled", String(!enabled));
    }
    if (tabLink) {
      tabLink.classList.toggle("is-disabled", !enabled);
      tabLink.setAttribute("aria-disabled", String(!enabled));
    }
  }

  function updateActiveTab() {
    const currentPage = document.body.dataset.page;
    if (!currentPage) {
      return;
    }

    document.querySelectorAll(".mobile-tab").forEach((tab) => {
      const isActive = tab.dataset.tab === currentPage;
      tab.classList.toggle("is-active", isActive);
      if (isActive) {
        tab.setAttribute("aria-current", "page");
      } else {
        tab.removeAttribute("aria-current");
      }
    });
  }

  function openMenu(menuButton, menuPanel, menuOverlay) {
    menuPanel.classList.remove("is-hidden");
    menuOverlay?.classList.remove("is-hidden");
    requestAnimationFrame(() => {
      menuPanel.classList.add("is-open");
      menuOverlay?.classList.add("is-open");
    });
    menuButton.setAttribute("aria-expanded", "true");
    document.body.classList.add("menu-open");
  }

  function closeMenu(menuButton, menuPanel, menuOverlay) {
    menuPanel.classList.remove("is-open");
    menuOverlay?.classList.remove("is-open");
    window.setTimeout(() => {
      menuPanel.classList.add("is-hidden");
      menuOverlay?.classList.add("is-hidden");
    }, 220);
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(readTheme());

    const menuButton = document.getElementById("menu-button");
    const menuPanel = document.getElementById("menu-panel");
    const menuOverlay = document.getElementById("menu-overlay");
    const themeToggle = document.getElementById("theme-toggle");
    const detailsLink = document.getElementById("journey-details-link");
    const mobileDetailsTab = document.querySelector(".mobile-details-tab");

    updateJourneyLink();
    updateActiveTab();

    if (menuButton && menuPanel) {
      menuButton.addEventListener("click", () => {
        const isOpen = menuPanel.classList.contains("is-open");
        if (isOpen) {
          closeMenu(menuButton, menuPanel, menuOverlay);
        } else {
          openMenu(menuButton, menuPanel, menuOverlay);
        }
      });

      document.addEventListener("click", (event) => {
        if (
          menuPanel.classList.contains("is-open") &&
          !menuPanel.contains(event.target) &&
          !menuButton.contains(event.target)
        ) {
          closeMenu(menuButton, menuPanel, menuOverlay);
        }
      });

      menuOverlay?.addEventListener("click", () => {
        closeMenu(menuButton, menuPanel, menuOverlay);
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

    if (mobileDetailsTab) {
      mobileDetailsTab.addEventListener("click", (event) => {
        if (mobileDetailsTab.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
        }
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuPanel?.classList.contains("is-open")) {
        closeMenu(menuButton, menuPanel, menuOverlay);
      }
    });

    window.addEventListener("storage", updateJourneyLink);
  });
})();
