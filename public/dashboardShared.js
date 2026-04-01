window.DashboardShared = (() => {
  const DATA_KEY = "travel-dashboard-data";

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
      minimumFractionDigits: 2,
    }).format(value);
  }

  function formatDate(isoDate) {
    return new Intl.DateTimeFormat("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${isoDate}T00:00:00`));
  }

  function formatShortDate(isoDate) {
    return new Intl.DateTimeFormat("en-SG", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${isoDate}T00:00:00`));
  }

  function formatWeekRange(weekStart) {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const formatter = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" });
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  function maxValue(items, key) {
    return items.reduce((max, item) => Math.max(max, item[key]), 0);
  }

  function renderBars(items, variant = "default", formatter = (value) => value) {
    if (!items.length) {
      return `<p class="empty-state">No data available.</p>`;
    }

    const max = maxValue(items, "value");
    return `
      <ul class="bar-list">
        ${items
          .map(
            (item) => `
              <li class="bar-row">
                <div class="bar-meta">
                  <strong>${item.label}</strong>
                  <span>${formatter(item.value)}</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill ${item.variant || variant}" style="width: ${
                    max ? (item.value / max) * 100 : 0
                  }%"></div>
                </div>
              </li>
            `
          )
          .join("")}
      </ul>
    `;
  }

  function renderTrendChart(points) {
    if (!points.length) {
      return `<p class="empty-state">No daily spend data available.</p>`;
    }

    const width = 700;
    const height = 240;
    const padding = 24;
    const maxSpend = maxValue(points, "spend") || 1;
    const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
    const coords = points.map((point, index) => {
      const x = padding + step * index;
      const y = height - padding - (point.spend / maxSpend) * (height - padding * 2);
      return { ...point, x, y };
    });
    const linePath = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPath = [
      `M ${coords[0].x} ${height - padding}`,
      ...coords.map((point) => `L ${point.x} ${point.y}`),
      `L ${coords[coords.length - 1].x} ${height - padding}`,
      "Z",
    ].join(" ");

    return `
      <div class="trend-chart">
        <svg viewBox="0 0 ${width} ${height}" class="trend-svg" role="img" aria-label="Daily travel spend">
          <path d="${areaPath}" class="trend-area"></path>
          <polyline points="${linePath}" class="trend-line"></polyline>
          ${coords
            .map(
              (point) =>
                `<circle cx="${point.x}" cy="${point.y}" r="5" class="trend-point"><title>${formatShortDate(
                  point.isoDate
                )}: ${formatCurrency(point.spend)}</title></circle>`
            )
            .join("")}
        </svg>
        <div class="trend-labels">
          ${coords
            .map(
              (point) =>
                `<span>${formatShortDate(point.isoDate)}<br />${formatCurrency(point.spend)}</span>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderMiniCards(items) {
    return `
      <section class="mini-grid">
        ${items
          .map(
            (item) => `
              <article class="mini-card">
                <p class="mini-label">${item.label}</p>
                <p class="mini-value">${item.value}</p>
                <p class="mini-note">${item.note}</p>
              </article>
            `
          )
          .join("")}
      </section>
    `;
  }

  function renderConclusionList(conclusions) {
    if (!conclusions.length) {
      return `<p class="empty-state">No conclusions available.</p>`;
    }
    return `<ul class="insight-list conclusions-list">${conclusions
      .map((item) => `<li>${item}</li>`)
      .join("")}</ul>`;
  }

  function getStoredData() {
    const stored = localStorage.getItem(DATA_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  function setStoredData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function clearStoredData() {
    localStorage.removeItem(DATA_KEY);
  }

  return {
    DATA_KEY,
    formatCurrency,
    formatDate,
    formatShortDate,
    formatWeekRange,
    renderBars,
    renderTrendChart,
    renderMiniCards,
    renderConclusionList,
    getStoredData,
    setStoredData,
    clearStoredData,
  };
})();
