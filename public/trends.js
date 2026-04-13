const trendsView = document.getElementById("trends-view");
const {
  getStoredData,
  formatCurrency,
  formatDate,
  formatWeekRange,
  renderBars,
  renderTrendChart,
  renderJourneyRouteLabel,
} = window.DashboardShared;

function parseTimeToMinutes(timeLabel) {
  const match = String(timeLabel || "").match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) {
    return null;
  }

  let [, hour, minute, meridiem] = match;
  let hours = Number(hour) % 12;
  if (meridiem.toUpperCase() === "PM") {
    hours += 12;
  }

  return hours * 60 + Number(minute);
}

function getTimeBucket(minutes) {
  if (minutes === null) {
    return "Unspecified";
  }
  if (minutes < 720) {
    return "Morning";
  }
  if (minutes < 1020) {
    return "Afternoon";
  }
  return "Evening";
}

function buildDayTimeline(journeys) {
  const buckets = {
    Morning: { label: "Morning", count: 0, spend: 0 },
    Afternoon: { label: "Afternoon", count: 0, spend: 0 },
    Evening: { label: "Evening", count: 0, spend: 0 },
  };

  journeys.forEach((journey) => {
    const firstTime = journey.legs?.[0]?.time || null;
    const bucket = getTimeBucket(parseTimeToMinutes(firstTime));
    if (!buckets[bucket]) {
      return;
    }
    buckets[bucket].count += 1;
    buckets[bucket].spend += journey.totalFare;
  });

  return Object.values(buckets).map((bucket) => ({
    ...bucket,
    spend: Number(bucket.spend.toFixed(2)),
  }));
}

function renderDayTimeline(items) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  return `
    <div class="day-timeline">
      ${items
        .map(
          (item) => `
            <article class="timeline-stop">
              <div class="timeline-track">
                <div class="timeline-bar" style="height: ${28 + (item.count / maxCount) * 88}px"></div>
              </div>
              <p class="timeline-label">${item.label}</p>
              <p class="timeline-meta">${item.count} trips</p>
              <p class="timeline-meta">${formatCurrency(item.spend)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTrends(data) {
  const routeLookup = new Map((data.journeys || []).map((journey) => [journey.route, journey]));
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
    label: renderJourneyRouteLabel(routeLookup.get(route.route) || { route: route.route, legs: [] }),
    value: route.spend,
  }));
  const dayTimeline = buildDayTimeline(data.journeys || []);

  trendsView.innerHTML = `
    <section class="panel">
      <h2 class="section-title">Day timeline</h2>
      <p class="section-subtitle">See whether you travelled more in the morning, afternoon, or evening.</p>
      ${renderDayTimeline(dayTimeline)}
    </section>

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
