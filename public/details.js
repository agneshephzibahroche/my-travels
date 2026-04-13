const detailsView = document.getElementById("details-view");
const { getStoredData, formatCurrency, formatDate, renderJourneyRouteLabel, renderLegDescriptor } =
  window.DashboardShared;

function getDayType(weekday) {
  return weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday";
}

function renderTableRows(journeys) {
  return journeys
    .map(
      (journey) => `
        <tr>
          <td>${formatDate(journey.isoDate)}<br /><span class="kicker">${journey.weekday || ""}</span></td>
          <td>${renderJourneyRouteLabel(journey)}</td>
          <td>${journey.legs
            .map((leg) => `${leg.time}<br />${renderLegDescriptor(leg)}`)
            .join("<br />")}</td>
          <td>${formatCurrency(journey.totalFare)}</td>
        </tr>
      `
    )
    .join("");
}

function renderMobileCards(journeys) {
  const byDay = journeys.reduce((accumulator, journey) => {
    if (!accumulator[journey.isoDate]) {
      accumulator[journey.isoDate] = [];
    }
    accumulator[journey.isoDate].push(journey);
    return accumulator;
  }, {});

  return Object.entries(byDay)
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([isoDate, dayJourneys]) => {
      const totalFare = dayJourneys.reduce((sum, journey) => sum + journey.totalFare, 0);
      const weekday = dayJourneys[0]?.weekday || "";

      return `
        <article class="journey-day-card">
          <div class="journey-day-topline">
            <div>
              <p class="journey-card-date">${formatDate(isoDate)}</p>
              <p class="journey-card-weekday">${weekday}</p>
            </div>
            <div class="journey-day-summary">
              <p class="journey-card-fare">${formatCurrency(totalFare)}</p>
              <p class="journey-day-count">${dayJourneys.length} journey${dayJourneys.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div class="journey-day-list">
            ${dayJourneys
              .map(
                (journey) => `
                  <section class="journey-card">
                    <div class="journey-card-topline">
                      <div class="journey-card-route">${renderJourneyRouteLabel(journey)}</div>
                      <p class="journey-card-fare">${formatCurrency(journey.totalFare)}</p>
                    </div>
                    <div class="journey-leg-list">
                      ${journey.legs
                        .map(
                          (leg) => `
                            <div class="journey-leg-item">
                              <span class="journey-leg-time">${leg.time}</span>
                              <span class="journey-leg-copy">${renderLegDescriptor(leg)}</span>
                            </div>
                          `
                        )
                        .join("")}
                    </div>
                  </section>
                `
              )
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDetails(data, filters = {}) {
  const search = (filters.search || "").trim().toLowerCase();
  const mode = filters.mode || "all";
  const dayType = filters.dayType || "all";
  const filteredJourneys = (data.journeys || []).filter((journey) => {
    const routeText = `${journey.route} ${journey.legs
      .map((leg) => `${leg.modeLabel} ${leg.route} ${leg.time}`)
      .join(" ")}`.toLowerCase();
    const searchMatch = !search || routeText.includes(search);
    const modeMatch =
      mode === "all" || journey.primaryMode.toLowerCase() === mode || journey.legs.some((leg) => leg.mode.toLowerCase() === mode);
    const dayTypeMatch = dayType === "all" || getDayType(journey.weekday) === dayType;
    return searchMatch && modeMatch && dayTypeMatch;
  });

  detailsView.innerHTML = `
    <section class="panel details-summary-panel">
      <div class="details-summary-grid">
        <article class="details-stat details-stat-coral">
          <p class="mini-label">Statement period</p>
          <p class="mini-value">${data.metadata.period || "N/A"}</p>
          <p class="mini-note">Monthly SimplyGo statement</p>
        </article>
        <article class="details-stat details-stat-blue">
          <p class="mini-label">Total spend</p>
          <p class="mini-value">${formatCurrency(data.metadata.totalCharged || 0)}</p>
          <p class="mini-note">${(data.journeys || []).length} journeys captured</p>
        </article>
      </div>
    </section>

    <section class="panel details-table-panel">
      <h2 class="section-title">Journey details</h2>
      <p class="section-subtitle">
        Search and filter the full journey rows from the uploaded statement.
      </p>
      <div class="metadata">
        <span><strong>Statement period:</strong> ${data.metadata.period || "N/A"}</span>
        <span><strong>Total:</strong> ${formatCurrency(data.metadata.totalCharged || 0)}</span>
        <span><strong>Showing:</strong> ${filteredJourneys.length} of ${(data.journeys || []).length} journeys</span>
      </div>
      <div class="filter-toolbar">
        <label class="filter-field">
          <span class="filter-label">Search</span>
          <input id="details-search" type="search" value="${filters.search || ""}" placeholder="Route, stop, service" />
        </label>
        <label class="filter-field">
          <span class="filter-label">Mode</span>
          <select id="details-mode">
            <option value="all" ${mode === "all" ? "selected" : ""}>All</option>
            <option value="train" ${mode === "train" ? "selected" : ""}>Train</option>
            <option value="bus" ${mode === "bus" ? "selected" : ""}>Bus</option>
            <option value="mixed" ${mode === "mixed" ? "selected" : ""}>Mixed</option>
          </select>
        </label>
        <label class="filter-field">
          <span class="filter-label">Day type</span>
          <select id="details-day-type">
            <option value="all" ${dayType === "all" ? "selected" : ""}>All days</option>
            <option value="weekday" ${dayType === "weekday" ? "selected" : ""}>Weekdays</option>
            <option value="weekend" ${dayType === "weekend" ? "selected" : ""}>Weekends</option>
          </select>
        </label>
        <button class="secondary-action" type="button" data-action="clear-detail-filters">Clear filters</button>
      </div>
      <div class="journey-cards">${renderMobileCards(data.journeys || [])}</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Journey</th>
              <th>Legs</th>
              <th>Fare</th>
            </tr>
          </thead>
          <tbody>${renderTableRows(filteredJourneys)}</tbody>
        </table>
      </div>
      ${filteredJourneys.length ? "" : `<p class="empty-state">No journeys matched those filters.</p>`}
    </section>
  `;

  const cardsContainer = detailsView.querySelector(".journey-cards");
  if (cardsContainer) {
    cardsContainer.innerHTML = renderMobileCards(filteredJourneys);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const data = getStoredData();
  if (!data) {
    return;
  }

  try {
    const filters = { search: "", mode: "all", dayType: "all" };
    const rerender = () => renderDetails(data, filters);
    rerender();

    detailsView.addEventListener("input", (event) => {
      if (event.target.id === "details-search") {
        filters.search = event.target.value;
        rerender();
      }
    });

    detailsView.addEventListener("change", (event) => {
      if (event.target.id === "details-mode") {
        filters.mode = event.target.value;
        rerender();
      }

      if (event.target.id === "details-day-type") {
        filters.dayType = event.target.value;
        rerender();
      }
    });

    detailsView.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action='clear-detail-filters']");
      if (!target) {
        return;
      }

      filters.search = "";
      filters.mode = "all";
      filters.dayType = "all";
      rerender();
    });
  } catch (error) {
    detailsView.innerHTML = `
      <section class="error-panel">
        Couldn't read the saved statement details. Please reload the statement from the main page.
      </section>
    `;
  }
});
