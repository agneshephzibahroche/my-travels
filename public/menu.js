(function () {
  const STORAGE_KEY = "travel-dashboard-theme";
  const DATA_KEY = "travel-dashboard-data";
  const HISTORY_KEY = "travel-dashboard-history";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const themeColor = theme === "dark" ? "#131a2d" : "#fff0d6";
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.setAttribute("content", themeColor);
  }

  function readTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateThemeToggleLabel() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.textContent = readTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }
  }

  // Desktop gets an always-visible nav built from the mobile tab bar so the pages stay in sync.
  function buildTopbarNav() {
    const topbar = document.querySelector(".topbar");
    const tabbar = document.querySelector(".mobile-tabbar");
    if (!topbar || !tabbar || topbar.querySelector(".topbar-nav")) {
      return;
    }

    const brand = document.createElement("a");
    brand.className = "topbar-brand";
    brand.href = "/";
    brand.textContent = "My Travels";

    const nav = document.createElement("nav");
    nav.className = "topbar-nav";
    nav.setAttribute("aria-label", "Main navigation");
    tabbar.querySelectorAll(".mobile-tab").forEach((tab) => {
      const link = tab.cloneNode(true);
      link.classList.remove("mobile-tab");
      link.classList.add("topbar-link");
      if (tab.classList.contains("mobile-details-tab")) {
        link.classList.remove("mobile-details-tab");
        link.classList.add("topbar-details-link");
      }
      nav.appendChild(link);
    });

    topbar.prepend(brand, nav);
  }

  buildTopbarNav();

  function updateJourneyLink() {
    const links = document.querySelectorAll("#journey-details-link, .mobile-details-tab, .topbar-details-link");
    if (!links.length) {
      return;
    }

    const hasData = Boolean(sessionStorage.getItem(DATA_KEY));
    const hasLocalData = Boolean(localStorage.getItem(DATA_KEY));
    const enabled = hasData || hasLocalData;
    links.forEach((link) => {
      link.classList.toggle("is-disabled", !enabled);
      link.setAttribute("aria-disabled", String(!enabled));
      if (enabled) {
        link.removeAttribute("title");
      } else {
        link.title = "Upload a statement first";
      }
    });
  }

  function updateActiveTab() {
    const currentPage = document.body.dataset.page;
    if (!currentPage) {
      return;
    }

    document.querySelectorAll(".mobile-tab, .topbar-link").forEach((tab) => {
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
    window.setTimeout(() => {
      menuPanel.querySelector("a:not(.is-disabled), button")?.focus({ preventScroll: true });
    }, 60);
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
    updateThemeToggleLabel();

    const menuButton = document.getElementById("menu-button");
    const menuPanel = document.getElementById("menu-panel");
    const menuOverlay = document.getElementById("menu-overlay");
    const themeToggle = document.getElementById("theme-toggle");
    const clearSavedData = document.getElementById("clear-saved-data");
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
        updateThemeToggleLabel();
      });
    }

    if (clearSavedData) {
      clearSavedData.addEventListener("click", () => {
        if (!window.confirm("Clear all saved statements from this browser? This can't be undone.")) {
          return;
        }
        localStorage.removeItem(DATA_KEY);
        localStorage.removeItem(HISTORY_KEY);
        window.dispatchEvent(new Event("storage"));
        if (window.location.pathname !== "/") {
          window.location.href = "/";
        } else {
          window.location.reload();
        }
      });
    }

    [detailsLink, mobileDetailsTab, document.querySelector(".topbar-details-link")].forEach((link) => {
      link?.addEventListener("click", (event) => {
        if (link.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuPanel?.classList.contains("is-open")) {
        closeMenu(menuButton, menuPanel, menuOverlay);
        menuButton.focus();
      }
    });

    window.addEventListener("storage", updateJourneyLink);
  });
})();
