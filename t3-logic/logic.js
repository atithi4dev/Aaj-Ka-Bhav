/**
 * logic.js - Aaj Ka Bhav (Person 3: Logic and Comparison)
 *
 * Pure functions. No DOM, no network, no storage. Runs in the browser
 * (<script type="module">) and in Node (for tests).
 *
 * Input: array of records in the shared data contract
 *   { commodity, state, district, market, date: 'YYYY-MM-DD',
 *     modal_price: number | null (Rs per quintal), arrivals?: number | null }
 *
 * Rules this file enforces:
 *   1. NEVER interpolate. A missing day stays missing.
 *   2. An old price is only ever shown as "last reported on <date>",
 *      never as if it were the current price.
 *   3. All prices are Rs per quintal. Person 1 must clean units first.
 */

// ---------------------------------------------------------------------------
// Labels (Hindi first). Person 2 can import these so wording stays consistent.
// We say "latest reported", never "live".
// ---------------------------------------------------------------------------
export const LABELS = {
  hi: {
    noRate: 'भाव उपलब्ध नहीं',
    lastReported: 'आखिरी दर्ज भाव',
    reportedOn: 'दर्ज तारीख',
    latest: 'ताज़ा दर्ज भाव',
    up: 'बढ़ा',
    down: 'घटा',
    flat: 'स्थिर',
    unknown: 'तुलना के लिए पिछला भाव नहीं',
    perQuintal: '₹ प्रति क्विंटल',
    best: 'सबसे अच्छा भाव',
    oldNote: 'यह पुराना भाव है',
    netAfterTransport: 'भाड़ा घटाकर',
  },
  en: {
    noRate: 'No rate reported',
    lastReported: 'Last reported rate',
    reportedOn: 'Reported on',
    latest: 'Latest reported rate',
    up: 'Up',
    down: 'Down',
    flat: 'Unchanged',
    unknown: 'No earlier rate to compare',
    perQuintal: 'Rs per quintal',
    best: 'Best rate',
    oldNote: 'This is an old rate',
    netAfterTransport: 'After transport cost',
  },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const DAY_MS = 86400000;

// 'YYYY-MM-DD' -> whole days since epoch (UTC, so no timezone surprises)
const toDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

export const daysBetween = (from, to) => toDay(to) - toDay(from);

export const addDays = (s, n) =>
  new Date((toDay(s) + n) * DAY_MS).toISOString().slice(0, 10);

/** Unique key for a market. Districts and markets repeat across states. */
export const marketKey = (r) => `${r.state}|${r.district}|${r.market}`;

/** A usable price is a positive finite number. 0 and null mean "not reported". */
const isPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Rs 2,450 (Indian digit grouping). */
export const formatPrice = (p) =>
  isPrice(p) ? `₹${Math.round(p).toLocaleString('en-IN')}` : '—';

// ---------------------------------------------------------------------------
// Series and reference date
// ---------------------------------------------------------------------------

/**
 * Reported prices for one market and commodity, oldest first.
 * Rows without a valid price are dropped (they are "not reported").
 * If the same date appears twice, the later row wins (Person 1 should dedupe).
 */
export function getSeries(records, { commodity, state, district, market }) {
  const byDate = new Map();
  for (const r of records) {
    if (r.commodity !== commodity) continue;
    if (state !== undefined && r.state !== state) continue;
    if (district !== undefined && r.district !== district) continue;
    if (market !== undefined && r.market !== market) continue;
    if (!isPrice(r.modal_price)) continue;
    byDate.set(r.date, { date: r.date, modal_price: r.modal_price });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The most recent date with at least one reported price for a commodity.
 * Used as "today" for the snapshot, so the app never claims a date it does not have.
 */
export function latestDataDate(records, commodity) {
  let best = null;
  for (const r of records) {
    if (commodity !== undefined && r.commodity !== commodity) continue;
    if (!isPrice(r.modal_price)) continue;
    if (best === null || r.date > best) best = r.date;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Latest rate and direction
// ---------------------------------------------------------------------------

/**
 * Turn a series into a displayable status.
 *   fresh : last reported price is on the reference date (or within freshDays)
 *   stale : there is a price, but older. Show it as "last reported", labelled old.
 *   none  : no reported price at all. Show "no rate reported".
 */
function describeLatest(series, ref, freshDays) {
  if (!series.length) {
    return { status: 'none', price: null, date: null, daysOld: null };
  }
  const last = series[series.length - 1];
  const daysOld = ref ? Math.max(0, daysBetween(last.date, ref)) : 0;
  return {
    status: daysOld <= freshDays ? 'fresh' : 'stale',
    price: last.modal_price,
    date: last.date,
    daysOld,
  };
}

/**
 * Latest reported rate for one commodity in one market.
 * opts: { asOf: 'YYYY-MM-DD', freshDays: 0 }
 * Returns { status: 'fresh'|'stale'|'none', price, date, daysOld }
 */
export function getLatestRate(records, sel, opts = {}) {
  const { asOf, freshDays = 0 } = opts;
  const ref = asOf ?? latestDataDate(records, sel.commodity);
  return describeLatest(getSeries(records, sel), ref, freshDays);
}

/**
 * Direction of the last two REPORTED prices in a series.
 * Compares against the previous reported rate (which may be days earlier);
 * gapDays tells the UI how far back that was ("vs 3 days earlier").
 * Returns { direction: 'up'|'down'|'flat'|'unknown', change, pct, fromPrice, fromDate, gapDays }
 */
export function getDirection(series) {
  if (!series || series.length < 2) {
    return { direction: 'unknown', change: null, pct: null, fromPrice: null, fromDate: null, gapDays: null };
  }
  const prev = series[series.length - 2];
  const last = series[series.length - 1];
  const change = last.modal_price - prev.modal_price;
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    change,
    pct: Math.round((change / prev.modal_price) * 1000) / 10,
    fromPrice: prev.modal_price,
    fromDate: prev.date,
    gapDays: daysBetween(prev.date, last.date),
  };
}

/** Convenience: latest rate + direction for the big rate card. */
export function getRateCard(records, sel, opts = {}) {
  const series = getSeries(records, sel);
  const ref = opts.asOf ?? latestDataDate(records, sel.commodity);
  return {
    ...describeLatest(series, ref, opts.freshDays ?? 0),
    ...getDirection(series),
  };
}

/**
 * Last n calendar days ending at the reference date, for the small chart.
 * Days with no reported price come back as price: null so the chart shows a GAP.
 * Do not connect the dots across gaps in the UI.
 */
export function getRecentDays(records, sel, n = 7, asOf) {
  const ref = asOf ?? latestDataDate(records, sel.commodity);
  if (!ref) return [];
  const priceByDate = new Map(getSeries(records, sel).map((p) => [p.date, p.modal_price]));
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(ref, -i);
    days.push({ date, price: priceByDate.has(date) ? priceByDate.get(date) : null });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Nearby mandi comparison ("where do I take it?")
// ---------------------------------------------------------------------------

function rankFresh(rows) {
  let rank = 0;
  return rows.map((r) => {
    if (r.status !== 'fresh') return { ...r, rank: null, isBest: false };
    rank += 1;
    return { ...r, rank, isBest: rank === 1 };
  });
}

/**
 * Compare mandis for one commodity.
 * sel:  { commodity, state, district }   (district marks "same district" mandis)
 * opts: { asOf, freshDays = 0, scope = 'state' | 'district', limit }
 *
 * We have no geo data here, so "nearby" = same state (or same district if
 * scope = 'district'). Each row carries sameDistrict so the UI can say so.
 *
 * Order (honest by design):
 *   1. fresh rates, highest first          <- ranked, the best one is flagged
 *   2. stale rates, most recent first      <- shown as "last reported", NOT ranked
 *   3. no rate reported                    <- shown as "no rate reported"
 * A stale price is never ranked against a fresh one.
 */
export function getNearbyMandis(records, sel, opts = {}) {
  const { commodity, state, district } = sel;
  const { asOf, freshDays = 0, scope = 'state', limit } = opts;
  const ref = asOf ?? latestDataDate(records, commodity);

  // Every market that has a row for this commodity, even a row with a null price.
  const markets = new Map();
  for (const r of records) {
    if (r.commodity !== commodity || r.state !== state) continue;
    if (scope === 'district' && r.district !== district) continue;
    markets.set(marketKey(r), { state: r.state, district: r.district, market: r.market });
  }

  const rows = [];
  for (const m of markets.values()) {
    const series = getSeries(records, { commodity, ...m });
    rows.push({
      ...m,
      key: marketKey(m),
      sameDistrict: m.district === district,
      ...describeLatest(series, ref, freshDays),
      ...getDirection(series),
    });
  }

  const byName = (a, b) => (a.market < b.market ? -1 : a.market > b.market ? 1 : 0);
  const fresh = rows
    .filter((r) => r.status === 'fresh')
    .sort((a, b) => b.price - a.price || Number(b.sameDistrict) - Number(a.sameDistrict) || byName(a, b));
  const stale = rows
    .filter((r) => r.status === 'stale')
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.price - a.price));
  const none = rows
    .filter((r) => r.status === 'none')
    .sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict) || byName(a, b));

  const ordered = rankFresh([...fresh, ...stale, ...none]);
  return limit ? ordered.slice(0, limit) : ordered;
}

// ---------------------------------------------------------------------------
// Stretch: transport cost (only use if the core is solid)
// ---------------------------------------------------------------------------

/** Straight-line distance in km between two {lat, lon} points. */
export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Re-rank fresh mandis by price after transport cost.
 *   distancesKm:        { [marketKey]: km }  (distance from the farmer)
 *   costPerQuintalPerKm: Rs per quintal per km. This is an ASSUMPTION, so the
 *                        UI must show it and let the user change it.
 * Mandis with no known distance get netPrice null and sort after the others.
 * Straight-line distance understates road distance, so say "approx." on screen.
 */
export function applyTransport(mandis, { distancesKm, costPerQuintalPerKm }) {
  const withNet = mandis.map((m) => {
    const km = distancesKm[m.key];
    if (m.status !== 'fresh' || km === undefined) {
      return { ...m, distanceKm: km ?? null, transportCost: null, netPrice: null };
    }
    const transportCost = km * costPerQuintalPerKm;
    return {
      ...m,
      distanceKm: km,
      transportCost,
      netPrice: m.price - transportCost,
    };
  });

  const fresh = withNet
    .filter((m) => m.status === 'fresh')
    .sort((a, b) => (b.netPrice ?? -Infinity) - (a.netPrice ?? -Infinity));
  const rest = withNet.filter((m) => m.status !== 'fresh');
  return rankFresh([...fresh, ...rest]);
}
