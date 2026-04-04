const patternsView = document.getElementById("patterns-view");
const { getStoredData, formatCurrency, renderBars, renderConclusionList } = window.DashboardShared;

function renderPatterns(data) {
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
  const takeawayItems = (data.analytics.topTakeaways || []).slice(0, 4);
  const unusualTripItems = (data.analytics.unusualTrips || []).map((trip) => ({
    label: `${trip.route} (${trip.isoDate})`,
    value: trip.totalFare,
  }));

  patternsView.innerHTML = `
    <section class="panel">
      <h2 class="section-title">Top takeaways</h2>
      <p class="section-subtitle">The shortest way to understand your travel habits.</p>
      <ul class="insight-list">
        ${takeawayItems
          .map(
            (item) => `
              <li>
                <span class="insight-label">${item.label}</span>
                <strong>${item.value}</strong><br />${item.note}
              </li>
            `
          )
          .join("")}
      </ul>
    </section>

    <section class="lower-grid">
      <article class="panel">
        <h2 class="section-title">Frequent travels</h2>
        <p class="section-subtitle">The routes and services you repeated most.</p>
        <h3 class="subsection-title">Journey groupings</h3>
        ${renderBars(frequentRouteItems, "default", formatCurrency)}
        <h3 class="subsection-title">Repeated leg patterns</h3>
        ${renderBars(frequentServiceItems, "default", formatCurrency)}
      </article>

      <article class="panel">
        <h2 class="section-title">Conclusions</h2>
        <p class="section-subtitle">Short takeaways based on your statement.</p>
        ${renderConclusionList(data.analytics.conclusions)}
        <ul class="insight-list compact-insights">
          <li>
            <span class="insight-label">Weekday vs weekend</span>
            Weekday ${formatCurrency(data.analytics.weekdayWeekendSplit.weekdaySpend)} |
            Weekend ${formatCurrency(data.analytics.weekdayWeekendSplit.weekendSpend)}
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
            <span class="insight-label">Most expensive route group</span>
            ${
              data.analytics.mostExpensiveRoute
                ? `${data.analytics.mostExpensiveRoute.route} at ${formatCurrency(data.analytics.mostExpensiveRoute.spend)}`
                : "No route data"
            }
          </li>
          <li>
            <span class="insight-label">Likely routine trip</span>
            ${
              data.analytics.likelyCommute
                ? `${data.analytics.likelyCommute.route} (${data.analytics.likelyCommute.trips} trips)`
                : "No repeated routine detected"
            }
          </li>
        </ul>
      </article>
    </section>

    <section class="panel">
      <h2 class="section-title">Unusual higher-cost trips</h2>
      <p class="section-subtitle">Trips that happened once but still stood out in cost.</p>
      ${renderBars(unusualTripItems, "default", formatCurrency)}
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = getStoredData();
  if (data) {
    renderPatterns(data);
  }
});
