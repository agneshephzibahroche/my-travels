window.DashboardShared = (() => {
  const DATA_KEY = "travel-dashboard-data";
  const HISTORY_KEY = "travel-dashboard-history";
  const MRT_LINES = {
    NSL: { code: "NSL", name: "North-South", color: "#d42e12" },
    EWL: { code: "EWL", name: "East-West", color: "#009645" },
    NEL: { code: "NEL", name: "North-East", color: "#9900aa" },
    CCL: { code: "CCL", name: "Circle", color: "#fa9e0d" },
    DTL: { code: "DTL", name: "Downtown", color: "#005ec4" },
    TEL: { code: "TEL", name: "Thomson-East Coast", color: "#9d5b25" },
    BPL: { code: "BPL", name: "Bukit Panjang LRT", color: "#748477" },
    SKLRT: { code: "SKLRT", name: "Sengkang LRT", color: "#748477" },
    PGLRT: { code: "PGLRT", name: "Punggol LRT", color: "#748477" },
  };
  const STATION_LINE_MAP = {
    "Ang Mo Kio": ["NSL"],
    Bishan: ["NSL", "CCL"],
    "Clarke Quay": ["NEL"],
    Rochor: ["DTL"],
    Serangoon: ["NEL", "CCL"],
    "Dhoby Ghaut": ["NSL", "NEL", "CCL"],
    HarbourFront: ["NEL", "CCL"],
    "Little India": ["NEL", "DTL"],
    "Chinatown": ["NEL", "DTL"],
    "Bencoolen": ["DTL"],
    Bugis: ["EWL", "DTL"],
    Newton: ["NSL", "DTL"],
    Orchard: ["NSL", "TEL"],
    Woodlands: ["NSL", "TEL"],
    Caldecott: ["CCL", "TEL"],
    "Stevens": ["DTL", "TEL"],
    "Botanic Gardens": ["CCL", "DTL"],
    "Marina Bay": ["NSL", "CCL", "TEL"],
  };

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

  function detectMrtLines(routeText) {
    const text = String(routeText || "");
    const found = new Set();

    if (/\bNSL\b/i.test(text) || /\bNorth[- ]South\b/i.test(text)) {
      found.add("NSL");
    }
    if (/\bEWL\b/i.test(text) || /\bEast[- ]West\b/i.test(text)) {
      found.add("EWL");
    }
    if (/\bNEL\b/i.test(text) || /\bNorth[- ]East\b/i.test(text)) {
      found.add("NEL");
    }
    if (/\bCCL\b/i.test(text) || /\bCircle\b/i.test(text)) {
      found.add("CCL");
    }
    if (/\bDTL\b/i.test(text) || /\bDowntown\b/i.test(text)) {
      found.add("DTL");
    }
    if (/\bTEL\b/i.test(text) || /\bThomson\b/i.test(text)) {
      found.add("TEL");
    }
    if (/\bNSEW\b/i.test(text)) {
      found.add("NSL");
      found.add("EWL");
    }

    Object.entries(STATION_LINE_MAP).forEach(([station, lines]) => {
      if (text.toLowerCase().includes(station.toLowerCase())) {
        lines.forEach((line) => found.add(line));
      }
    });

    return [...found].map((code) => MRT_LINES[code]).filter(Boolean);
  }

  function renderMrtBadgesFromLines(lines) {
    if (!lines.length) {
      return "";
    }

    return `
      <span class="mrt-line-group" aria-label="MRT lines detected">
        ${lines
          .map(
            (line) => `
              <span class="mrt-line-pill" style="--mrt-line-color: ${line.color}" title="${line.name} Line">
                ${line.code}
              </span>
            `
          )
          .join("")}
      </span>
    `;
  }

  function renderMrtBadges(routeText) {
    return renderMrtBadgesFromLines(detectMrtLines(routeText));
  }

  function renderRouteLabel(routeText) {
    const badges = renderMrtBadges(routeText);
    if (!badges) {
      return routeText;
    }

    return `
      <span class="route-with-badges">
        ${badges}
        <span class="route-text">${routeText}</span>
      </span>
    `;
  }

  function renderTrainRouteLabel(routeText, mode = "Train") {
    if (mode !== "Train") {
      return routeText;
    }

    return renderRouteLabel(routeText);
  }

  function renderJourneyRouteLabel(journey) {
    const trainLines = (journey.legs || [])
      .filter((leg) => leg.mode === "Train")
      .flatMap((leg) => detectMrtLines(leg.route));
    const uniqueLines = [...new Map(trainLines.map((line) => [line.code, line])).values()];
    const badges = renderMrtBadgesFromLines(uniqueLines);

    if (!badges) {
      return journey.route;
    }

    return `
      <span class="route-with-badges">
        ${badges}
        <span class="route-text">${journey.route}</span>
      </span>
    `;
  }

  function renderStopPills(routeText, mode = "Bus") {
    const parts = String(routeText || "")
      .split(" - ")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      return "";
    }

    return `
      <span class="stop-pill-row">
        ${parts
          .map(
            (part) => `
              <span class="stop-pill ${mode === "Train" ? "train-stop-pill" : "bus-stop-pill"}">${part}</span>
            `
          )
          .join("")}
      </span>
    `;
  }

  function renderServiceChip(leg) {
    if (leg.mode === "Bus") {
      return `<span class="service-chip bus-service-chip">Bus ${leg.service || ""}</span>`;
    }

    const lines = detectMrtLines(leg.route);
    const primary = lines[0];
    return `
      <span class="service-chip train-service-chip">
        ${primary ? primary.code : "Train"}
      </span>
    `;
  }

  function renderLegDescriptor(leg) {
    return `
      <span class="leg-descriptor">
        ${renderServiceChip(leg)}
        ${leg.mode === "Train" ? renderTrainRouteLabel(leg.route, leg.mode) : renderStopPills(leg.route, leg.mode)}
      </span>
    `;
  }

  function getUsedMrtLines(journeys = []) {
    const found = new Map();
    journeys.forEach((journey) => {
      (journey.legs || [])
        .filter((leg) => leg.mode === "Train")
        .forEach((leg) => {
          detectMrtLines(leg.route).forEach((line) => {
            found.set(line.code, line);
          });
        });
    });
    return [...found.values()];
  }

  function renderMrtLegend(journeys, title = "MRT lines spotted", subtitle = "Train legs are tagged with Singapore MRT colours.") {
    const lines = getUsedMrtLines(journeys);
    if (!lines.length) {
      return "";
    }

    return `
      <section class="panel transport-network-panel">
        <h2 class="section-title">${title}</h2>
        <p class="section-subtitle">${subtitle}</p>
        <div class="network-chip-row">
          ${lines
            .map(
              (line) => `
                <span class="network-chip" style="--mrt-line-color: ${line.color}">
                  <span class="network-chip-code">${line.code}</span>
                  <span class="network-chip-name">${line.name}</span>
                </span>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function getStoredData() {
    const stored = localStorage.getItem(DATA_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      statementId:
        parsed.statementId ||
        parsed.id ||
        `${parsed.metadata?.period || parsed.label || "statement"}-current`,
    };
  }

  function setStoredData(data) {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  }

  function getStoredHistory() {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored
      ? JSON.parse(stored).map((entry, index) => ({
          ...entry,
          statementId:
            entry.statementId ||
            entry.id ||
            `${entry.metadata?.period || entry.label || "statement"}-${index}`,
        }))
      : [];
  }

  function setStoredHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function createHistoryEntry(data, sourceLabel = "Uploaded statement") {
    return {
      id:
        data.statementId ||
        `${data.metadata?.period || "statement"}-${data.metadata?.totalCharged || 0}-${Date.now()}`,
      statementId:
        data.statementId ||
        `${data.metadata?.period || "statement"}-${data.metadata?.totalCharged || 0}-${Date.now()}`,
      label: data.metadata?.period || sourceLabel,
      sourceLabel,
      uploadedAt: new Date().toISOString(),
      metadata: data.metadata,
      summary: data.summary,
      analytics: data.analytics,
      charts: data.charts,
      journeys: data.journeys,
      legs: data.legs,
    };
  }

  function saveStatement(data, sourceLabel = "Uploaded statement") {
    const entry = createHistoryEntry(data, sourceLabel);
    const history = getStoredHistory().filter((item) => item.label !== entry.label);
    const nextHistory = [entry, ...history].slice(0, 12);
    setStoredData(entry);
    setStoredHistory(nextHistory);
    return entry;
  }

  function loadStatementFromHistory(statementId) {
    const entry = getStoredHistory().find((item) => item.statementId === statementId);
    if (entry) {
      setStoredData(entry);
    }
    return entry || null;
  }

  function clearStoredData() {
    localStorage.removeItem(DATA_KEY);
  }

  function clearAllStoredData() {
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(HISTORY_KEY);
  }

  return {
    DATA_KEY,
    HISTORY_KEY,
    formatCurrency,
    formatDate,
    formatShortDate,
    formatWeekRange,
    renderBars,
    renderTrendChart,
    renderMiniCards,
    renderConclusionList,
    renderMrtBadges,
    renderRouteLabel,
    renderTrainRouteLabel,
    renderJourneyRouteLabel,
    renderStopPills,
    renderServiceChip,
    renderLegDescriptor,
    renderMrtLegend,
    getUsedMrtLines,
    getStoredData,
    getStoredHistory,
    setStoredData,
    setStoredHistory,
    saveStatement,
    loadStatementFromHistory,
    clearStoredData,
    clearAllStoredData,
  };
})();
