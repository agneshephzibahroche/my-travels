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

function filterJourneys(journeys, filters) {
  const search = (filters.search || "").trim().toLowerCase();
  const mode = filters.mode || "all";
  const dayType = filters.dayType || "all";
  return journeys.filter((journey) => {
    const routeText = `${journey.route} ${journey.legs
      .map((leg) => `${leg.modeLabel} ${leg.route} ${leg.time}`)
      .join(" ")}`.toLowerCase();
    const searchMatch = !search || routeText.includes(search);
    const modeMatch =
      mode === "all" || journey.primaryMode.toLowerCase() === mode || journey.legs.some((leg) => leg.mode.toLowerCase() === mode);
    const dayTypeMatch = dayType === "all" || getDayType(journey.weekday) === dayType;
    return searchMatch && modeMatch && dayTypeMatch;
  });
}

function hasActiveFilters(filters) {
  return Boolean((filters.search || "").trim()) || filters.mode !== "all" || filters.dayType !== "all";
}

// Only the results are re-rendered on filter changes so the search box keeps focus while typing.
function renderResults(data, filters) {
  const allJourneys = data.journeys || [];
  const filteredJourneys = filterJourneys(allJourneys, filters);

  detailsView.querySelector("[data-role='showing-count']").textContent =
    `${filteredJourneys.length} of ${allJourneys.length} journeys`;
  detailsView.querySelector(".journey-cards").innerHTML = renderMobileCards(filteredJourneys);
  detailsView.querySelector("tbody").innerHTML = renderTableRows(filteredJourneys);
  detailsView.querySelector(".table-wrapper").hidden = !filteredJourneys.length;
  detailsView.querySelector("[data-role='no-results']").hidden = Boolean(filteredJourneys.length);
  detailsView.querySelector("[data-action='clear-detail-filters']").disabled = !hasActiveFilters(filters);
}

function renderDetails(data, filters) {
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
      <div class="filter-toolbar" role="search">
        <label class="filter-field">
          <span class="filter-label">Search</span>
          <input id="details-search" type="search" autocomplete="off" placeholder="Route, stop, service" />
        </label>
        <label class="filter-field">
          <span class="filter-label">Mode</span>
          <select id="details-mode">
            <option value="all">All</option>
            <option value="train">Train</option>
            <option value="bus">Bus</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label class="filter-field">
          <span class="filter-label">Day type</span>
          <select id="details-day-type">
            <option value="all">All days</option>
            <option value="weekday">Weekdays</option>
            <option value="weekend">Weekends</option>
          </select>
        </label>
        <button class="secondary-action" type="button" data-action="clear-detail-filters">Clear filters</button>
      </div>
      <p class="results-count" aria-live="polite">Showing <strong data-role="showing-count"></strong></p>
      <div class="journey-cards"></div>
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
          <tbody></tbody>
        </table>
      </div>
      <p class="empty-state" data-role="no-results" hidden>No journeys matched those filters.</p>
    </section>
  `;

  renderResults(data, filters);
}

document.addEventListener("DOMContentLoaded", () => {
  const data = getStoredData();
  if (!data) {
    return;
  }

  try {
    const filters = { search: "", mode: "all", dayType: "all" };
    const rerender = () => renderResults(data, filters);
    renderDetails(data, filters);

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
      document.getElementById("details-search").value = "";
      document.getElementById("details-mode").value = "all";
      document.getElementById("details-day-type").value = "all";
      rerender();
      document.getElementById("details-search").focus();
    });
  } catch (error) {
    detailsView.innerHTML = `
      <section class="error-panel">
        Couldn't read the saved statement details. Please reload the statement from the main page.
      </section>
    `;
  }
});
