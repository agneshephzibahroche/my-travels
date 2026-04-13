const dashboard = document.getElementById("dashboard");
const fileInput = document.getElementById("statement-file");
const dropZone = document.getElementById("drop-zone");
const cardTemplate = document.getElementById("card-template");
const {
  formatCurrency,
  formatDate,
  renderMiniCards,
  renderMrtLegend,
  getStoredData,
  getStoredHistory,
  saveStatement,
  loadStatementFromHistory,
  clearAllStoredData,
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
  const history = getStoredHistory();
  const previousStatement = history.find((entry) => entry.statementId !== data.statementId) || null;
  const comparisonItems = previousStatement
    ? [
        {
          label: "Spend change",
          value: formatCurrency(data.summary.totalCharged - previousStatement.summary.totalCharged),
          note: `${formatCurrency(data.summary.totalCharged)} vs ${formatCurrency(previousStatement.summary.totalCharged)}`,
        },
        {
          label: "Journey change",
          value: `${data.summary.totalJourneys - previousStatement.summary.totalJourneys}`,
          note: `${data.summary.totalJourneys} vs ${previousStatement.summary.totalJourneys} journeys`,
        },
        {
          label: "Average fare",
          value: formatCurrency(data.summary.averageJourneyFare - previousStatement.summary.averageJourneyFare),
          note: `${formatCurrency(data.summary.averageJourneyFare)} vs ${formatCurrency(
            previousStatement.summary.averageJourneyFare
          )}`,
        },
      ]
    : [];
  dashboard.classList.remove("loading");
  dashboard.innerHTML = `
    <section class="panel actions-panel">
      <div class="actions-row">
        <button class="secondary-action" type="button" data-action="upload-new">Upload another statement</button>
        <button class="secondary-action secondary-action-danger" type="button" data-action="clear-data">Clear saved rides</button>
      </div>
    </section>

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
      <p class="section-subtitle">Your station-board summary of this statement.</p>
      ${renderMiniCards(quickCards)}
    </section>

    ${renderMrtLegend(
      data.journeys,
      "MRT lines on your month",
      "Train legs are highlighted with Singapore MRT colours so repeated rail routes are easier to spot."
    )}

    <section class="lower-grid">
      <article class="panel">
        <h2 class="section-title">Statement comparison</h2>
        <p class="section-subtitle">
          ${
            previousStatement
              ? `See how this statement moved compared with ${previousStatement.metadata?.period || previousStatement.label}.`
              : "Upload one more statement to unlock a month-to-month route check."
          }
        </p>
        ${
          comparisonItems.length
            ? renderMiniCards(comparisonItems)
            : `<p class="empty-state">One more uploaded statement will unlock comparison insights here.</p>`
        }
      </article>

      <article class="panel">
        <h2 class="section-title">Statement history</h2>
        <p class="section-subtitle">Hop between saved statements without uploading again.</p>
        <div class="history-list">
          ${history
            .map(
              (entry) => `
                <button
                  class="history-chip ${entry.statementId === data.statementId ? "is-active" : ""}"
                  type="button"
                  data-action="load-history"
                  data-statement-id="${entry.statementId}"
                >
                  <span class="history-chip-title">${entry.metadata?.period || entry.label}</span>
                  <span class="history-chip-note">${formatCurrency(entry.summary.totalCharged)} · ${entry.summary.totalJourneys} journeys</span>
                </button>
              `
            )
            .join("")}
        </div>
      </article>
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

  const saved = saveStatement(data, data.source || file.name);
  renderDashboard(saved, data.source || file.name);
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

dashboard.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  if (actionTarget.dataset.action === "upload-new") {
    fileInput.click();
    return;
  }

  if (actionTarget.dataset.action === "clear-data") {
    clearAllStoredData();
    dashboard.classList.add("is-hidden");
    dashboard.classList.remove("loading");
    dashboard.innerHTML = `
      <section class="empty-panel">
        <h2 class="section-title">Waiting for statement</h2>
        <p class="section-subtitle">Upload a SimplyGo statement on this page to generate the dashboard.</p>
      </section>
    `;
    document.body.classList.remove("has-insights");
    window.dispatchEvent(new Event("storage"));
    return;
  }

  if (actionTarget.dataset.action === "load-history") {
    const loaded = loadStatementFromHistory(actionTarget.dataset.statementId);
    if (loaded) {
      renderDashboard(loaded, loaded.sourceLabel || "Saved statement");
    }
  }
});
