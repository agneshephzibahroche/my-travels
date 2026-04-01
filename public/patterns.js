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

  patternsView.innerHTML = `
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
              data.charts.topRoutes[0]
                ? `${data.charts.topRoutes[0].route} at ${formatCurrency(data.charts.topRoutes[0].spend)}`
                : "No route data"
            }
          </li>
        </ul>
      </article>
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = getStoredData();
  if (data) {
    renderPatterns(data);
  }
});
