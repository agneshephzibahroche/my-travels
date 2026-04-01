const trendsView = document.getElementById("trends-view");
const { getStoredData, formatCurrency, formatDate, formatWeekRange, renderBars, renderTrendChart } =
  window.DashboardShared;

function renderTrends(data) {
  const modeItems = Object.entries(data.charts.totalsByMode).map(([mode, value]) => ({
    label: mode,
    value,
    variant: mode.toLowerCase(),
  }));
  const weeklyItems = data.charts.weeklySpend.map((week) => ({
    label: formatWeekRange(week.weekStart),
    value: week.spend,
  }));
  const dailyItems = data.charts.dailySpend.map((day) => ({
    label: formatDate(day.isoDate),
    value: day.spend,
  }));
  const routeItems = data.charts.topRoutes.map((route) => ({
    label: route.route,
    value: route.spend,
  }));

  trendsView.innerHTML = `
    <section class="charts-grid">
      <article class="panel">
        <h2 class="section-title">Daily spend trend</h2>
        <p class="section-subtitle">See which days cost more.</p>
        ${renderTrendChart(data.charts.dailySpend)}
      </article>
      <article class="panel">
        <h2 class="section-title">Weekly expense</h2>
        <p class="section-subtitle">Weekly totals grouped into easy chunks.</p>
        ${renderBars(weeklyItems, "default", formatCurrency)}
      </article>
    </section>

    <section class="charts-grid">
      <article class="panel">
        <h2 class="section-title">Spend by mode</h2>
        <p class="section-subtitle">A simple split between bus and train.</p>
        ${renderBars(modeItems, "default", formatCurrency)}
      </article>
      <article class="panel">
        <h2 class="section-title">Daily expense breakdown</h2>
        <p class="section-subtitle">Compare your active travel days side by side.</p>
        ${renderBars(dailyItems, "default", formatCurrency)}
      </article>
    </section>

    <section class="panel">
      <h2 class="section-title">Top routes by expense</h2>
      <p class="section-subtitle">Where most of your money went.</p>
      ${renderBars(routeItems, "default", formatCurrency)}
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = getStoredData();
  if (data) {
    renderTrends(data);
  }
});
