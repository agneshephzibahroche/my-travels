const fs = require("fs");
const PDFParser = require("pdf2json");

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

function formatIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatAmount(value) {
  return value.toFixed(2);
}

function splitAndCleanLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\f/g, "").trim())
    .filter((line) => {
      if (!line) {
        return false;
      }

      return ![
        "STATEMENT GENERATED ON",
        "PAGE 1 OF 2",
        "PAGE 2 OF 2",
        "Date             Journey                                                                      Charges",
        "Date       Journey                                             Charges",
        "Only public transit transactions will be reflected in this statement.",
      ].includes(line);
    })
    .filter((line) => !/^----------------Page \(\d+\) Break----------------$/.test(line));
}

function extractMetadata(cleanLines) {
  const generatedOnIndex = cleanLines.findIndex((line) =>
    /^\d{2} \w{3} \d{4}$/.test(line)
  );
  const periodLine = cleanLines.find((line) =>
    /^\d{2} \w{3} \d{4} - \d{2} \w{3} \d{4}$/.test(line)
  );
  const totalLine = cleanLines.find((line) => /^Total:\s+\$\s*[\d.]+$/.test(line));
  const splitTotalIndex = cleanLines.findIndex((line) => line === "Total:");
  const splitTotalLine =
    splitTotalIndex >= 0 && /^\$\s*[\d.]+$/.test(cleanLines[splitTotalIndex + 1] || "")
      ? cleanLines[splitTotalIndex + 1]
      : null;

  return {
    generatedOn: generatedOnIndex >= 0 ? cleanLines[generatedOnIndex] : null,
    period: periodLine || null,
    totalCharged: totalLine
      ? moneyToNumber(totalLine)
      : splitTotalLine
        ? moneyToNumber(splitTotalLine)
        : 0,
  };
}

function buildJourney(displayDate, weekday, route, totalFare, legs) {
  const uniqueModes = [...new Set(legs.map((leg) => leg.mode))];

  return {
    date: displayDate,
    isoDate: toIsoDate(displayDate),
    weekday,
    route,
    totalFare,
    legs,
    legCount: legs.length,
    primaryMode:
      uniqueModes.length === 1 ? uniqueModes[0] : uniqueModes.length > 1 ? "Mixed" : "Unknown",
  };
}

function parseInlineJourneys(cleanLines) {
  const journeys = [];

  for (let index = 0; index < cleanLines.length; index += 1) {
    const line = cleanLines[index];
    const headerMatch = line.match(
      /^(\d{2} \w{3} \d{4})\s+(.+?)\s+\$\s*([\d.]+)$/
    );

    if (!headerMatch) {
      continue;
    }

    const [, displayDate, route, chargeText] = headerMatch;
    const weekdayLine = cleanLines[index + 1] || "";
    const weekdayMatch = weekdayLine.match(/^\((\w{3})\)$/);
    const legs = [];
    let cursor = index + (weekdayMatch ? 2 : 1);

    while (cursor < cleanLines.length) {
      const candidate = cleanLines[cursor];

      if (
        /^(\d{2} \w{3} \d{4})\s+/.test(candidate) ||
        /^Total:\s+\$\s*[\d.]+$/.test(candidate)
      ) {
        break;
      }

      const legMatch = candidate.match(
        /^(\d{2}:\d{2} [AP]M)\s+(Train|Bus(?: \d+)?)\s+(.+?)\s+\$\s*([\d.]+)$/
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

    journeys.push(
      buildJourney(
        displayDate,
        weekdayMatch ? weekdayMatch[1] : null,
        route,
        moneyToNumber(chargeText),
        legs
      )
    );

    index = cursor - 1;
  }

  return journeys;
}

function parseStackedJourneys(cleanLines) {
  const journeys = [];

  for (let index = 0; index < cleanLines.length; index += 1) {
    const displayDate = cleanLines[index];
    const weekdayLine = cleanLines[index + 1];
    const route = cleanLines[index + 2];

    if (!/^\d{2} \w{3} \d{4}$/.test(displayDate || "")) {
      continue;
    }

    const weekdayMatch = String(weekdayLine || "").match(/^\((\w{3})\)$/);
    if (!weekdayMatch || !route || /^\d{2} \w{3} \d{4} - \d{2} \w{3} \d{4}$/.test(route)) {
      continue;
    }

    const legs = [];
    let totalFare = null;
    let cursor = index + 3;

    while (cursor < cleanLines.length) {
      const candidate = cleanLines[cursor];

      if (/^\d{2} \w{3} \d{4}$/.test(candidate) || /^Total:\s+\$\s*[\d.]+$/.test(candidate)) {
        break;
      }

      const timeModeMatch = candidate.match(/^(\d{2}:\d{2} [AP]M)\s+(Train|Bus(?: \d+)?)$/);
      if (timeModeMatch) {
        const nextLine = cleanLines[cursor + 1] || "";
        const routeFareMatch = nextLine.match(/^(.+?)\s+\$\s*([\d.]+)$/);

        if (routeFareMatch) {
          const [, time, modeLabel] = timeModeMatch;
          const [, legRoute, fareText] = routeFareMatch;
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

          cursor += 2;
          continue;
        }
      }

      if (/^\$\s*[\d.]+$/.test(candidate)) {
        totalFare = moneyToNumber(candidate);
        cursor += 1;
        break;
      }

      cursor += 1;
    }

    if (legs.length > 0 && totalFare !== null) {
      journeys.push(buildJourney(displayDate, weekdayMatch[1], route, totalFare, legs));
      index = cursor - 1;
    }
  }

  return journeys;
}

function buildStatementData(metadata, journeys) {
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
  const likelyCommute = sortedRouteFrequency.find((route) => route.trips >= 2) || null;
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
    ? Number((((roundedTotalsByMode.Bus || 0) / metadata.totalCharged) * 100).toFixed(1))
    : 0;
  const trainShare = metadata.totalCharged
    ? Number((((roundedTotalsByMode.Train || 0) / metadata.totalCharged) * 100).toFixed(1))
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

function parsePdfText(rawText) {
  const cleanLines = splitAndCleanLines(rawText);
  const metadata = extractMetadata(cleanLines);
  const journeys = parseInlineJourneys(cleanLines);
  const statementJourneys = journeys.length > 0 ? journeys : parseStackedJourneys(cleanLines);

  if (statementJourneys.length === 0) {
    throw new Error("Unable to extract journeys from the statement.");
  }

  return buildStatementData(metadata, statementJourneys);
}

function extractPdfTextFromParser(runParser) {
  process.env.PDF2JSON_DISABLE_LOGS = "1";

  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    const originalWarn = console.warn;
    const originalLog = console.log;
    const restoreConsole = () => {
      console.warn = originalWarn;
      console.log = originalLog;
    };

    console.warn = () => {};
    console.log = () => {};

    parser.on("pdfParser_dataError", (error) => {
      restoreConsole();
      reject(error?.parserError || error);
    });

    parser.on("pdfParser_dataReady", () => {
      const rawText = parser.getRawTextContent();
      restoreConsole();

      if (!rawText.trim()) {
        reject(new Error("Unable to extract text from the PDF statement."));
        return;
      }

      resolve(rawText);
    });

    try {
      runParser(parser);
    } catch (error) {
      restoreConsole();
      reject(error);
    }
  });
}

async function parseStatementPdf(pdfPath) {
  if (!pdfPath || !fs.existsSync(pdfPath)) {
    throw new Error(`Statement PDF not found at ${pdfPath}`);
  }

  const rawText = await extractPdfTextFromParser((parser) => {
    parser.loadPDF(pdfPath, 0);
  });

  return parsePdfText(rawText);
}

function parseStatementText(textPath) {
  if (!textPath || !fs.existsSync(textPath)) {
    throw new Error(`Statement text snapshot not found at ${textPath}`);
  }

  return parsePdfText(fs.readFileSync(textPath, "utf8"));
}

async function parseStatementFile(filePath) {
  const lowerFilePath = filePath.toLowerCase();

  if (lowerFilePath.endsWith(".txt")) {
    return parseStatementText(filePath);
  }

  if (lowerFilePath.endsWith(".pdf")) {
    return parseStatementPdf(filePath);
  }

  throw new Error("Unsupported statement format. Use a .pdf or .txt file.");
}

async function parseStatementBuffer(buffer, fileName = "statement.txt") {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".txt")) {
    return parsePdfText(buffer.toString("utf8"));
  }

  if (lowerFileName.endsWith(".pdf")) {
    const rawText = await extractPdfTextFromParser((parser) => {
      parser.parseBuffer(buffer, 0);
    });

    return parsePdfText(rawText);
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
