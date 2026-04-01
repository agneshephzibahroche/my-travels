const dashboard = document.getElementById("dashboard");
const fileInput = document.getElementById("statement-file");
const dropZone = document.getElementById("drop-zone");
const loadSampleButton = document.getElementById("load-sample");
const cardTemplate = document.getElementById("card-template");
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

  const formatter = new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function createMetricCard(label, value, note) {
  const fragment = cardTemplate.content.cloneNode(true);
  fragment.querySelector(".metric-label").textContent = label;
  fragment.querySelector(".metric-value").textContent = value;
  fragment.querySelector(".metric-note").textContent = note;
  return fragment;
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

function renderConclusionList(conclusions) {
  if (!conclusions.length) {
    return `<p class="empty-state">No conclusions available.</p>`;
  }

  return `
    <ul class="insight-list conclusions-list">
      ${conclusions.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function renderMiniCards(items) {
  if (!items.length) {
    return "";
  }

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

function renderDashboard(data, activePath) {
  dashboard.classList.remove("is-hidden");
  sessionStorage.setItem(DATA_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("storage"));
  const modeItems = Object.entries(data.charts.totalsByMode).map(([mode, value]) => ({
    label: mode,
    value,
    variant: mode.toLowerCase(),
  }));
  const routeItems = data.charts.topRoutes.map((route) => ({
    label: route.route,
    value: route.spend,
  }));
  const weeklyItems = data.charts.weeklySpend.map((week) => ({
    label: formatWeekRange(week.weekStart),
    value: week.spend,
  }));
  const dailyItems = data.charts.dailySpend.map((day) => ({
    label: formatDate(day.isoDate),
    value: day.spend,
  }));
  const frequentRouteItems = data.analytics.routeFrequency.slice(0, 5).map((route) => ({
    label: `${route.route} (${route.trips} trips)`,
    value: route.spend,
  }));
  const frequentServiceItems = data.analytics.serviceFrequency.slice(0, 5).map((service) => ({
    label: `${service.label} (${service.uses} uses)`,
    value: service.spend,
    variant: service.mode.toLowerCase(),
  }));
  const weekdayItems = data.charts.weekdaySpend.map((item) => ({
    label: item.weekday,
    value: item.spend,
  }));

  const busiestDay = data.summary.busiestDay
    ? `${formatDate(data.summary.busiestDay.isoDate)} (${data.summary.busiestDay.trips} journeys)`
    : "N/A";
  const periodLabel = data.metadata.period
    ? data.metadata.period.split(" - ")[0].slice(3, 11)
    : "N/A";
  const quickCards = [
    {
      label: "Spent most on",
      value: data.analytics.highestSpendDay
        ? formatDate(data.analytics.highestSpendDay.isoDate)
        : "N/A",
      note: data.analytics.highestSpendDay
        ? formatCurrency(data.analytics.highestSpendDay.spend)
        : "No spend data",
    },
    {
      label: "Most frequent trip",
      value: data.analytics.mostFrequentRoute
        ? `${data.analytics.mostFrequentRoute.trips} trips`
        : "N/A",
      note: data.analytics.mostFrequentRoute
        ? data.analytics.mostFrequentRoute.route
        : "No route data",
    },
    {
      label: "Most used service",
      value: data.analytics.mostUsedService
        ? `${data.analytics.mostUsedService.uses} uses`
        : "N/A",
      note: data.analytics.mostUsedService
        ? data.analytics.mostUsedService.label
        : "No service data",
    },
    {
      label: "Main mode",
      value:
        data.analytics.spendShare.train >= data.analytics.spendShare.bus
          ? "Train"
          : "Bus",
      note: `Train ${data.analytics.spendShare.train}% | Bus ${data.analytics.spendShare.bus}%`,
    },
  ];

  dashboard.classList.remove("loading");
  dashboard.innerHTML = `
    <section class="metrics-grid">
      ${(() => {
        const container = document.createElement("div");
        container.appendChild(
          createMetricCard(
            "Total spend",
            formatCurrency(data.summary.totalCharged),
            `${data.summary.totalJourneys} journeys across ${data.summary.totalLegs} legs`
          )
        );
        container.appendChild(
          createMetricCard(
            "Average journey fare",
            formatCurrency(data.summary.averageJourneyFare),
            `Across ${data.summary.uniqueRoutes} unique route groupings`
          )
        );
        container.appendChild(
          createMetricCard(
            "Busiest travel day",
            data.summary.busiestDay ? String(data.summary.busiestDay.trips) : "0",
            busiestDay
          )
        );
        container.appendChild(
          createMetricCard(
            "Statement period",
            periodLabel,
            data.metadata.period || "No period found"
          )
        );
        return container.innerHTML;
      })()}
    </section>

    <section class="panel">
      <h2 class="section-title">Quick read</h2>
      <p class="section-subtitle">
        The fastest way to understand your statement.
      </p>
      ${renderMiniCards(quickCards)}
    </section>

    <section class="charts-grid">
      <article class="panel">
        <h2 class="section-title">Daily spend trend</h2>
        <p class="section-subtitle">
          See which days cost more.
        </p>
        ${renderTrendChart(data.charts.dailySpend)}
      </article>

      <article class="panel">
        <h2 class="section-title">Weekly expense</h2>
        <p class="section-subtitle">
          Weekly totals, grouped into easy chunks.
        </p>
        ${renderBars(weeklyItems, "default", formatCurrency)}
      </article>
    </section>

    <section class="charts-grid">
      <article class="panel">
        <h2 class="section-title">Spend by mode</h2>
        <p class="section-subtitle">
          A simple split between bus and train.
        </p>
        ${renderBars(modeItems, "default", formatCurrency)}
      </article>

      <article class="panel">
        <h2 class="section-title">Daily expense breakdown</h2>
        <p class="section-subtitle">
          Compare your active travel days side by side.
        </p>
        ${renderBars(dailyItems, "default", formatCurrency)}
      </article>
    </section>

    <section class="lower-grid">
      <article class="panel">
        <h2 class="section-title">Frequent travels</h2>
        <p class="section-subtitle">
          The routes and services you repeated most.
        </p>
        <h3 class="subsection-title">Journey groupings</h3>
        ${renderBars(frequentRouteItems, "default", formatCurrency)}
        <h3 class="subsection-title">Repeated leg patterns</h3>
        ${renderBars(frequentServiceItems, "default", formatCurrency)}
      </article>

      <article class="panel">
        <h2 class="section-title">Conclusions</h2>
        <p class="section-subtitle">
          Short takeaways based on your statement.
        </p>
        ${renderConclusionList(data.analytics.conclusions)}
        <ul class="insight-list compact-insights">
          <li>
            <span class="insight-label">Most expensive route group</span>
            ${
              data.charts.topRoutes[0]
                ? `${data.charts.topRoutes[0].route} at ${formatCurrency(data.charts.topRoutes[0].spend)}`
                : "No route data"
            }
          </li>
          <li>
            <span class="insight-label">Weekday spend profile</span>
            ${weekdayItems.map((item) => `${item.label}: ${formatCurrency(item.value)}`).join(" | ")}
          </li>
          <li>
            <span class="insight-label">Mode split</span>
            Train ${data.analytics.spendShare.train}% | Bus ${data.analytics.spendShare.bus}%
          </li>
          <li>
            <span class="insight-label">Data source</span>
            ${activePath}
          </li>
          <li>
            <span class="insight-label">Statement generated</span>
            ${data.metadata.generatedOn || "Not detected"}
          </li>
        </ul>
      </article>
    </section>

    <section class="panel">
      <h2 class="section-title">Top routes by expense</h2>
      <p class="section-subtitle">
        Where most of your money went.
      </p>
      ${renderBars(routeItems, "default", formatCurrency)}
      <div class="metadata">
        <span><strong>Loaded path:</strong> ${activePath}</span>
        <span><strong>Total from statement:</strong> ${formatCurrency(data.metadata.totalCharged)}</span>
        <span><strong>Need the full trip list?</strong> Open the journey details page from the menu.</span>
      </div>
    </section>
  `;
}

function renderError(message) {
  dashboard.classList.remove("is-hidden");
  dashboard.classList.remove("loading");
  dashboard.innerHTML = `<section class="error-panel">${message}</section>`;
}

async function loadStatement(statementPath = "") {
  dashboard.classList.remove("is-hidden");
  dashboard.classList.add("loading");
  dashboard.innerHTML = `<section class="loading-panel">Loading statement data...</section>`;

  const params = new URLSearchParams();
  if (statementPath) {
    params.set("path", statementPath);
  }

  const response = await fetch(`/api/statement${params.toString() ? `?${params}` : ""}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to load statement.");
  }

  renderDashboard(
    data,
    statementPath || "Bundled snapshot from SimplyGo Statement Feb 2026 5197.pdf"
  );
}

async function uploadStatementFile(file) {
  dashboard.classList.remove("is-hidden");
  dashboard.classList.add("loading");
  dashboard.innerHTML = `<section class="loading-panel">Generating dashboard from ${file.name}...</section>`;

  const response = await fetch("/api/statement/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: await file.arrayBuffer(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to upload statement.");
  }

  renderDashboard(data, data.source || file.name);
}

async function handleSelectedFile(file) {
  if (!file) {
    return;
  }

  try {
    await uploadStatementFile(file);
  } catch (error) {
    renderError(error.message);
  }
}

function setDraggingState(isDragging) {
  dropZone.classList.toggle("is-dragging", isDragging);
}

dropZone.addEventListener("click", () => {
  fileInput.click();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  await handleSelectedFile(file);
  fileInput.value = "";
});

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  setDraggingState(true);
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  setDraggingState(true);
});

dropZone.addEventListener("dragleave", (event) => {
  if (!dropZone.contains(event.relatedTarget)) {
    setDraggingState(false);
  }
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  setDraggingState(false);
  const [file] = event.dataTransfer.files || [];
  await handleSelectedFile(file);
});

loadSampleButton.addEventListener("click", async () => {
  try {
    await loadStatement();
  } catch (error) {
    renderError(error.message);
  }
});
