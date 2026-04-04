const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const PDFTOTEXT_CANDIDATES = [
  "C:/Users/User/AppData/Local/Programs/MiKTeX/miktex/bin/x64/pdftotext.exe",
  "pdftotext",
];

function choosePdfToText() {
  for (const candidate of PDFTOTEXT_CANDIDATES) {
    if (candidate.endsWith(".exe") && fs.existsSync(candidate)) {
      return candidate;
    }

    const result = spawnSync(candidate, ["-v"], { encoding: "utf8" });
    if (!result.error) {
      return candidate;
    }
  }

  throw new Error("Unable to locate pdftotext. Install it or update the parser.");
}

function moneyToNumber(value) {
  const match = String(value).match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
}

function toIsoDate(value) {
  const [day, monthName, year] = value.split(" ");
  const monthIndex = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].indexOf(monthName);

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
}

function getWeekStart(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function isWeekend(weekday) {
  return weekday === "Sat" || weekday === "Sun";
}

function parsePdfText(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\f/g, "").replace(/\s+$/g, ""));

  const cleanLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }

    return ![
      "STATEMENT GENERATED ON",
      "PAGE 1 OF 2",
      "PAGE 2 OF 2",
      "Date             Journey                                                                      Charges",
      "Date             Journey                                                                      Charges",
      "Only public transit transactions will be reflected in this statement.",
    ].includes(trimmed);
  });

  const generatedOnIndex = cleanLines.findIndex((line) =>
    /^\d{2} \w{3} \d{4}$/.test(line.trim())
  );
  const periodLine = cleanLines.find((line) =>
    /^\d{2} \w{3} \d{4} - \d{2} \w{3} \d{4}$/.test(line.trim())
  );
  const totalLine = cleanLines.find((line) => /^Total:\s+\$\s*[\d.]+$/.test(line.trim()));

  const metadata = {
    generatedOn: generatedOnIndex >= 0 ? cleanLines[generatedOnIndex].trim() : null,
    period: periodLine ? periodLine.trim() : null,
    totalCharged: totalLine ? moneyToNumber(totalLine) : 0,
  };

  const journeys = [];

  for (let index = 0; index < cleanLines.length; index += 1) {
    const line = cleanLines[index];
    const headerMatch = line.match(
      /^\s*(\d{2} \w{3} \d{4})\s+(.+?)\s+\$\s*([\d.]+)\s*$/
    );

    if (!headerMatch) {
      continue;
    }

    const [, displayDate, route, chargeText] = headerMatch;
    const weekdayLine = cleanLines[index + 1] || "";
    const weekdayMatch = weekdayLine.match(/^\s*\((\w{3})\)\s*$/);
    const legs = [];
    let cursor = index + (weekdayMatch ? 2 : 1);

    while (cursor < cleanLines.length) {
      const candidate = cleanLines[cursor];

      if (
        /^\s*(\d{2} \w{3} \d{4})\s+/.test(candidate) ||
        /^\s*Total:\s+\$\s*[\d.]+$/.test(candidate)
      ) {
        break;
      }

      const legMatch = candidate.match(
        /^\s*(\d{2}:\d{2} [AP]M)\s+(Train|Bus(?: \d+)?)\s+(.+?)\s+\$\s*([\d.]+)\s*$/
      );

      if (legMatch) {
        const [, time, modeLabel, legRoute, fareText] = legMatch;
        const mode = modeLabel.startsWith("Bus") ? "Bus" : "Train";
        const service = mode === "Bus" ? modeLabel.replace("Bus", "").trim() : null;

        legs.push({
          time,
          mode,
          modeLabel,
          service: service || null,
          route: legRoute,
          fare: moneyToNumber(fareText),
        });
      }

      cursor += 1;
    }

    const totalFare = moneyToNumber(chargeText);
    const uniqueModes = [...new Set(legs.map((leg) => leg.mode))];

    journeys.push({
      date: displayDate,
      isoDate: toIsoDate(displayDate),
      weekday: weekdayMatch ? weekdayMatch[1] : null,
      route,
      totalFare,
      legs,
      legCount: legs.length,
      primaryMode:
        uniqueModes.length === 1 ? uniqueModes[0] : uniqueModes.length > 1 ? "Mixed" : "Unknown",
    });

    index = cursor - 1;
  }

  const legRows = journeys.flatMap((journey) =>
    journey.legs.map((leg) => ({
      date: journey.date,
      isoDate: journey.isoDate,
      weekday: journey.weekday,
      parentRoute: journey.route,
      ...leg,
    }))
  );

  const totalsByMode = legRows.reduce((accumulator, leg) => {
    accumulator[leg.mode] = (accumulator[leg.mode] || 0) + leg.fare;
    return accumulator;
  }, {});

  const dailySpend = journeys.reduce((accumulator, journey) => {
    accumulator[journey.isoDate] = (accumulator[journey.isoDate] || 0) + journey.totalFare;
    return accumulator;
  }, {});

  const journeysByRoute = journeys.reduce((accumulator, journey) => {
    if (!accumulator[journey.route]) {
      accumulator[journey.route] = { route: journey.route, trips: 0, spend: 0 };
    }

    accumulator[journey.route].trips += 1;
    accumulator[journey.route].spend += journey.totalFare;
    return accumulator;
  }, {});

  const weekdaySpend = journeys.reduce((accumulator, journey) => {
    const key = journey.weekday || "N/A";
    accumulator[key] = (accumulator[key] || 0) + journey.totalFare;
    return accumulator;
  }, {});
  const weeklySpend = journeys.reduce((accumulator, journey) => {
    const weekStart = getWeekStart(journey.isoDate);
    accumulator[weekStart] = (accumulator[weekStart] || 0) + journey.totalFare;
    return accumulator;
  }, {});
  const routeFrequency = journeys.reduce((accumulator, journey) => {
    if (!accumulator[journey.route]) {
      accumulator[journey.route] = {
        route: journey.route,
        trips: 0,
        spend: 0,
        averageFare: 0,
      };
    }

    accumulator[journey.route].trips += 1;
    accumulator[journey.route].spend += journey.totalFare;
    accumulator[journey.route].averageFare =
      accumulator[journey.route].spend / accumulator[journey.route].trips;

    return accumulator;
  }, {});
  const serviceFrequency = legRows.reduce((accumulator, leg) => {
    const label = leg.mode === "Bus" ? `Bus ${leg.service}` : leg.route;
    if (!accumulator[label]) {
      accumulator[label] = {
        label,
        mode: leg.mode,
        uses: 0,
        spend: 0,
      };
    }

    accumulator[label].uses += 1;
    accumulator[label].spend += leg.fare;
    return accumulator;
  }, {});
  const weekdayWeekendSpend = journeys.reduce(
    (accumulator, journey) => {
      const bucket = isWeekend(journey.weekday) ? "weekend" : "weekday";
      accumulator[bucket] += journey.totalFare;
      return accumulator;
    },
    { weekday: 0, weekend: 0 }
  );

  const roundedTotalsByMode = Object.fromEntries(
    Object.entries(totalsByMode).map(([mode, spend]) => [mode, Number(spend.toFixed(2))])
  );
  const sortedDailySpend = Object.entries(dailySpend)
    .map(([isoDate, spend]) => ({ isoDate, spend: Number(spend.toFixed(2)) }))
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate));
  const sortedWeeklySpend = Object.entries(weeklySpend)
    .map(([weekStart, spend]) => ({
      weekStart,
      spend: Number(spend.toFixed(2)),
    }))
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  const sortedRouteFrequency = Object.values(routeFrequency)
    .map((route) => ({
      ...route,
      spend: Number(route.spend.toFixed(2)),
      averageFare: Number(route.averageFare.toFixed(2)),
    }))
    .sort((left, right) => right.trips - left.trips || right.spend - left.spend);
  const sortedServiceFrequency = Object.values(serviceFrequency)
    .map((service) => ({
      ...service,
      spend: Number(service.spend.toFixed(2)),
    }))
    .sort((left, right) => right.uses - left.uses || right.spend - left.spend);
  const highestSpendDay = [...sortedDailySpend].sort((left, right) => right.spend - left.spend)[0] || null;
  const mostFrequentRoute = sortedRouteFrequency[0] || null;
  const mostUsedService = sortedServiceFrequency[0] || null;
  const mostExpensiveRoute =
    [...sortedRouteFrequency].sort((left, right) => right.spend - left.spend || right.trips - left.trips)[0] ||
    null;
  const weekdaySpendTotal = Number(weekdayWeekendSpend.weekday.toFixed(2));
  const weekendSpendTotal = Number(weekdayWeekendSpend.weekend.toFixed(2));
  const weekdayWeekendSplit = {
    weekdaySpend: weekdaySpendTotal,
    weekendSpend: weekendSpendTotal,
    weekdayShare: metadata.totalCharged
      ? Number(((weekdaySpendTotal / metadata.totalCharged) * 100).toFixed(1))
      : 0,
    weekendShare: metadata.totalCharged
      ? Number(((weekendSpendTotal / metadata.totalCharged) * 100).toFixed(1))
      : 0,
  };
  const likelyCommute =
    sortedRouteFrequency.find((route) => route.trips >= 2) || null;
  const unusualTrips = journeys
    .filter(
      (journey) =>
        journey.totalFare >= 2 &&
        sortedRouteFrequency.find((route) => route.route === journey.route)?.trips === 1
    )
    .sort((left, right) => right.totalFare - left.totalFare)
    .slice(0, 3)
    .map((journey) => ({
      isoDate: journey.isoDate,
      route: journey.route,
      totalFare: Number(journey.totalFare.toFixed(2)),
    }));
  const topTakeaways = [
    highestSpendDay
      ? {
          label: "Highest spend day",
          value: formatIsoDate(highestSpendDay.isoDate),
          note: `${highestSpendDay.spend.toFixed(2)} in fares`,
        }
      : null,
    mostExpensiveRoute
      ? {
          label: "Biggest cost route",
          value: mostExpensiveRoute.route,
          note: `${formatAmount(mostExpensiveRoute.spend)} across ${mostExpensiveRoute.trips} trips`,
        }
      : null,
    likelyCommute
      ? {
          label: "Likely routine trip",
          value: likelyCommute.route,
          note: `${likelyCommute.trips} repeated trips`,
        }
      : null,
    {
      label: "Weekday vs weekend",
      value:
        weekdayWeekendSplit.weekdaySpend >= weekdayWeekendSplit.weekendSpend ? "Mostly weekday travel" : "Mostly weekend travel",
      note: `${weekdayWeekendSplit.weekdayShare}% weekday | ${weekdayWeekendSplit.weekendShare}% weekend`,
    },
  ].filter(Boolean);
  const busShare = metadata.totalCharged
    ? Number(((roundedTotalsByMode.Bus || 0) / metadata.totalCharged * 100).toFixed(1))
    : 0;
  const trainShare = metadata.totalCharged
    ? Number(((roundedTotalsByMode.Train || 0) / metadata.totalCharged * 100).toFixed(1))
    : 0;
  const conclusions = [
    highestSpendDay
      ? `Your highest-spend day was ${highestSpendDay.isoDate}, with ${highestSpendDay.spend.toFixed(2)} in fares.`
      : null,
    mostFrequentRoute
      ? `Your most frequent journey grouping was "${mostFrequentRoute.route}", appearing ${mostFrequentRoute.trips} times and costing ${mostFrequentRoute.spend.toFixed(2)} overall.`
      : null,
    mostExpensiveRoute
      ? `The route costing you the most overall was "${mostExpensiveRoute.route}", adding up to ${mostExpensiveRoute.spend.toFixed(2)}.`
      : null,
    mostUsedService
      ? `Your most repeated leg pattern was "${mostUsedService.label}", used ${mostUsedService.uses} times for ${mostUsedService.spend.toFixed(2)} in total.`
      : null,
    likelyCommute
      ? `A likely routine trip is "${likelyCommute.route}" because it appears ${likelyCommute.trips} times in this statement.`
      : null,
    metadata.totalCharged
      ? `You spent ${weekdayWeekendSplit.weekdayShare}% on weekdays and ${weekdayWeekendSplit.weekendShare}% on weekends.`
      : null,
    unusualTrips.length
      ? `Your priciest one-off trip was "${unusualTrips[0].route}" on ${unusualTrips[0].isoDate}, costing ${unusualTrips[0].totalFare.toFixed(2)}.`
      : null,
    `Train travel made up ${trainShare}% of spend, while bus travel made up ${busShare}% of spend.`,
  ].filter(Boolean);

  return {
    metadata,
    summary: {
      totalJourneys: journeys.length,
      totalLegs: legRows.length,
      totalCharged: metadata.totalCharged,
      averageJourneyFare:
        journeys.length > 0 ? Number((metadata.totalCharged / journeys.length).toFixed(2)) : 0,
      busiestDay:
        Object.entries(
          journeys.reduce((accumulator, journey) => {
            accumulator[journey.isoDate] = (accumulator[journey.isoDate] || 0) + 1;
            return accumulator;
          }, {})
        )
          .map(([isoDate, trips]) => ({ isoDate, trips }))
          .sort((left, right) => right.trips - left.trips || left.isoDate.localeCompare(right.isoDate))[0] ||
        null,
      uniqueRoutes: Object.keys(journeysByRoute).length,
    },
    charts: {
      totalsByMode: roundedTotalsByMode,
      dailySpend: sortedDailySpend,
      weeklySpend: sortedWeeklySpend,
      weekdaySpend: Object.entries(weekdaySpend)
        .map(([weekday, spend]) => ({ weekday, spend: Number(spend.toFixed(2)) }))
        .sort((left, right) => left.weekday.localeCompare(right.weekday)),
      topRoutes: Object.values(journeysByRoute)
        .map((route) => ({
          ...route,
          spend: Number(route.spend.toFixed(2)),
        }))
        .sort((left, right) => right.spend - left.spend || right.trips - left.trips)
        .slice(0, 5),
    },
    analytics: {
      highestSpendDay,
      mostFrequentRoute,
      mostExpensiveRoute,
      mostUsedService,
      likelyCommute,
      unusualTrips,
      weekdayWeekendSplit,
      topTakeaways,
      routeFrequency: sortedRouteFrequency,
      serviceFrequency: sortedServiceFrequency,
      conclusions,
      spendShare: {
        bus: busShare,
        train: trainShare,
      },
    },
    journeys,
    legs: legRows,
  };
}

function formatIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatAmount(value) {
  return value.toFixed(2);
}

function parseStatementPdf(pdfPath) {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`Statement PDF not found at ${pdfPath}`);
  }

  const pdftotext = choosePdfToText();
  const result = spawnSync(pdftotext, ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const output = result.stdout || "";
  if (!output.trim()) {
    throw new Error("Unable to extract text from the PDF statement.");
  }

  return parsePdfText(output);
}

function parseStatementText(textPath) {
  if (!textPath || !fs.existsSync(textPath)) {
    throw new Error(`Statement text snapshot not found at ${textPath}`);
  }

  return parsePdfText(fs.readFileSync(textPath, "utf8"));
}

function parseStatementFile(filePath) {
  const lowerFilePath = filePath.toLowerCase();

  if (lowerFilePath.endsWith(".txt")) {
    return parseStatementText(filePath);
  }

  if (lowerFilePath.endsWith(".pdf")) {
    return parseStatementPdf(filePath);
  }

  throw new Error("Unsupported statement format. Use a .pdf or .txt file.");
}

function parseStatementBuffer(buffer, fileName = "statement.txt") {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".txt")) {
    return parsePdfText(buffer.toString("utf8"));
  }

  if (lowerFileName.endsWith(".pdf")) {
    const tempPath = path.join(
      os.tmpdir(),
      `statement-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`
    );

    fs.writeFileSync(tempPath, buffer);

    try {
      return parseStatementPdf(tempPath);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  throw new Error("Unsupported uploaded statement format. Use a .pdf or .txt file.");
}

module.exports = {
  parseStatementBuffer,
  parseStatementFile,
  parsePdfText,
  parseStatementPdf,
  parseStatementText,
};
