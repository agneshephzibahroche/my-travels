const detailsView = document.getElementById("details-view");
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

function renderTableRows(journeys) {
  return journeys
    .map(
      (journey) => `
        <tr>
          <td>${formatDate(journey.isoDate)}<br /><span class="kicker">${journey.weekday || ""}</span></td>
          <td>${journey.route}</td>
          <td>${journey.legs.map((leg) => `${leg.time} ${leg.modeLabel}: ${leg.route}`).join("<br />")}</td>
          <td>${formatCurrency(journey.totalFare)}</td>
        </tr>
      `
    )
    .join("");
}

function renderDetails(data) {
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
        Full journey rows from the uploaded statement.
      </p>
      <div class="metadata">
        <span><strong>Statement period:</strong> ${data.metadata.period || "N/A"}</span>
        <span><strong>Total:</strong> ${formatCurrency(data.metadata.totalCharged || 0)}</span>
      </div>
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
          <tbody>${renderTableRows(data.journeys || [])}</tbody>
        </table>
      </div>
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const stored = sessionStorage.getItem(DATA_KEY);
  if (!stored) {
    return;
  }

  try {
    renderDetails(JSON.parse(stored));
  } catch (error) {
    detailsView.innerHTML = `
      <section class="error-panel">
        Couldn't read the saved statement details. Please reload the statement from the main page.
      </section>
    `;
  }
});
