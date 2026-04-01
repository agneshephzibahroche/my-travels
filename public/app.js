const dashboard = document.getElementById("dashboard");
const fileInput = document.getElementById("statement-file");
const dropZone = document.getElementById("drop-zone");
const cardTemplate = document.getElementById("card-template");
const {
  formatCurrency,
  formatDate,
  renderMiniCards,
  getStoredData,
  setStoredData,
} = window.DashboardShared;

function createMetricCard(label, value, note) {
  const fragment = cardTemplate.content.cloneNode(true);
  fragment.querySelector(".metric-label").textContent = label;
  fragment.querySelector(".metric-value").textContent = value;
  fragment.querySelector(".metric-note").textContent = note;
  return fragment;
}

function renderDashboard(data, activePath) {
  document.body.classList.add("has-insights");
  dashboard.classList.remove("is-hidden");
  setStoredData(data);
  window.dispatchEvent(new Event("storage"));

  const busiestDay = data.summary.busiestDay
    ? `${formatDate(data.summary.busiestDay.isoDate)} (${data.summary.busiestDay.trips} journeys)`
    : "N/A";
  const periodLabel = data.metadata.period
    ? data.metadata.period.split(" - ")[0].slice(3, 11)
    : "N/A";

  const quickCards = [
    {
      label: "Spent most on",
      value: data.analytics.highestSpendDay ? formatDate(data.analytics.highestSpendDay.isoDate) : "N/A",
      note: data.analytics.highestSpendDay ? formatCurrency(data.analytics.highestSpendDay.spend) : "No spend data",
    },
    {
      label: "Most frequent trip",
      value: data.analytics.mostFrequentRoute ? `${data.analytics.mostFrequentRoute.trips} trips` : "N/A",
      note: data.analytics.mostFrequentRoute ? data.analytics.mostFrequentRoute.route : "No route data",
    },
    {
      label: "Most used service",
      value: data.analytics.mostUsedService ? `${data.analytics.mostUsedService.uses} uses` : "N/A",
      note: data.analytics.mostUsedService ? data.analytics.mostUsedService.label : "No service data",
    },
    {
      label: "Main mode",
      value: data.analytics.spendShare.train >= data.analytics.spendShare.bus ? "Train" : "Bus",
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
          createMetricCard("Statement period", periodLabel, data.metadata.period || "No period found")
        );
        return container.innerHTML;
      })()}
    </section>

    <section class="panel">
      <h2 class="section-title">Quick read</h2>
      <p class="section-subtitle">The fastest way to understand your statement.</p>
      ${renderMiniCards(quickCards)}
    </section>

    <section class="section-links-grid">
      <a class="section-link-card trends-card" href="/trends.html">
        <span class="section-link-kicker">Sub page</span>
        <h3>Spend trends</h3>
        <p>Daily trend, weekly totals, mode split, and route spend.</p>
      </a>
      <a class="section-link-card patterns-card" href="/patterns.html">
        <span class="section-link-kicker">Sub page</span>
        <h3>Patterns</h3>
        <p>Frequent travels, repeated services, and statement conclusions.</p>
      </a>
      <a class="section-link-card details-card" href="/details.html">
        <span class="section-link-kicker">Sub page</span>
        <h3>Journey details</h3>
        <p>Full trip rows, leg-level fares, and the detailed statement view.</p>
      </a>
    </section>

    <section class="panel">
      <h2 class="section-title">Overview only</h2>
      <p class="section-subtitle">
        This page stays intentionally short on mobile. Open the sub pages above for the deeper sections.
      </p>
      <div class="metadata">
        <span><strong>Loaded path:</strong> ${activePath}</span>
        <span><strong>Total from statement:</strong> ${formatCurrency(data.metadata.totalCharged)}</span>
      </div>
    </section>
  `;
}

function renderError(message) {
  document.body.classList.remove("has-insights");
  dashboard.classList.remove("is-hidden");
  dashboard.classList.remove("loading");
  dashboard.innerHTML = `<section class="error-panel">${message}</section>`;
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

dropZone.addEventListener("click", () => fileInput.click());
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

document.addEventListener("DOMContentLoaded", () => {
  const stored = getStoredData();
  if (stored) {
    renderDashboard(stored, "Previously uploaded statement");
  } else {
    document.body.classList.remove("has-insights");
  }
});
