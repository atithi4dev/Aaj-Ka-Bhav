// logic.js: the rules that decide what the farmer sees. Pure functions, no DOM.
// Contract (data/data.json: prices): { commodity, state, district, market, date, modal_price, arrivals }
// modal_price is Rs per quintal. null (or 0, or anything that is not a positive number) = not reported.
//
// Hard rules, enforced here and nowhere else:
//   1. A missing price is never filled in, averaged or carried forward as "today's" rate.
//   2. A market with no price on the reference date is "no_rate". Its last known rate is
//      returned separately and must be labelled old by the UI.
//   3. Markets are keyed on state + district + market (district names repeat across states).

const DAY = 86400000;

let CROP = new Map();   // commodity -> Map(marketKey -> { info, rows: [{date, price}] sorted ascending })
let REF = new Map();    // commodity -> newest date that has a reported price
let NEAR = {};          // "State|District" -> [district names]. Optional.

export const marketKey = (m) => `${m.state}|${m.district}|${m.market}`;
export const isReported = (p) => typeof p === 'number' && Number.isFinite(p) && p > 0;

const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY);
export const addDays = (s, n) => new Date(toUTC(s) + n * DAY).toISOString().slice(0, 10);

/** Load the dataset. Duplicate (commodity, market, date) rows are collapsed: a reported price wins over null. */
export function setData(records, nearby = {}) {
  CROP = new Map(); REF = new Map(); NEAR = nearby || {};
  for (const r of records) {
    if (!r || !r.commodity || !r.market || !r.date) continue;
    if (!CROP.has(r.commodity)) CROP.set(r.commodity, new Map());
    const markets = CROP.get(r.commodity);
    const key = marketKey(r);
    if (!markets.has(key)) markets.set(key, { info: { state: r.state, district: r.district, market: r.market, key }, byDate: new Map() });
    const entry = markets.get(key);
    const price = isReported(r.modal_price) ? r.modal_price : null;
    const arrivals = typeof r.arrivals === 'number' && Number.isFinite(r.arrivals) && r.arrivals >= 0 ? r.arrivals : null;
    const had = entry.byDate.get(r.date);
    if (had === undefined || (had.price === null && price !== null)) entry.byDate.set(r.date, { price, arrivals });
    if (price !== null) {
      const cur = REF.get(r.commodity);
      if (!cur || r.date > cur) REF.set(r.commodity, r.date);
    }
  }
  for (const markets of CROP.values()) {
    for (const e of markets.values()) {
      e.rows = [...e.byDate].map(([date, v]) => ({ date, price: v.price, arrivals: v.arrivals })).sort((a, b) => (a.date < b.date ? -1 : 1));
    }
  }
}

export const getCommodityNames = () => [...CROP.keys()];

/** Newest date on which this commodity has any reported price. The day "latest reported" is measured against. */
export const getReferenceDate = (commodity) => REF.get(commodity) || null;

/** Every state + district that has at least one record, sorted. */
export function getDistricts() {
  const seen = new Map();
  for (const markets of CROP.values())
    for (const { info } of markets.values()) seen.set(`${info.state}|${info.district}`, { state: info.state, district: info.district });
  return [...seen.values()].sort((a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district));
}

const entryOf = (commodity, market) => {
  const key = typeof market === 'string' ? market : marketKey(market);
  return CROP.get(commodity)?.get(key) || null;
};

const reportedRows = (e) => e.rows.filter((r) => r.price !== null);

/**
 * Latest reported rate for one market.
 *  status 'reported' : has a price on the reference date. price/date/arrivals are set.
 *  status 'no_rate'  : no price on the reference date. price is null, lastKnown holds the older rate (label it old).
 *  status 'none'     : this market has never reported this commodity.
 * arrivals (quantity traded that day, in the source's own unit) is informational only: never used to
 * judge, hide or adjust a price, only to show how many deals it is based on. null means not reported.
 */
export function getLatestRate(commodity, market) {
  const e = entryOf(commodity, market);
  const refDate = getReferenceDate(commodity);
  const rep = e ? reportedRows(e) : [];
  const last = rep.length ? rep[rep.length - 1] : null;
  if (!last) return { status: 'none', price: null, date: null, refDate, lastKnown: null, ageDays: null, arrivals: null };
  const lastKnown = { price: last.price, date: last.date, arrivals: last.arrivals };
  if (last.date === refDate) return { status: 'reported', price: last.price, date: last.date, refDate, lastKnown, ageDays: 0, arrivals: last.arrivals };
  return { status: 'no_rate', price: null, date: null, refDate, lastKnown, ageDays: refDate ? daysBetween(last.date, refDate) : null, arrivals: null };
}

/**
 * Up, down or flat: latest reported rate against the previous reported rate of the same market.
 * The previous report may be several days earlier, so its date is returned and must be shown.
 * dir 'none' carries reason 'no_rate' (never reported) or 'no_previous' (only one report so far).
 */
export function getDirection(commodity, market) {
  const e = entryOf(commodity, market);
  const rep = e ? reportedRows(e) : [];
  if (!rep.length) return { dir: 'none', reason: 'no_rate', delta: null, latest: null, previous: null };
  const latest = rep[rep.length - 1];
  if (rep.length < 2) return { dir: 'none', reason: 'no_previous', delta: null, latest, previous: null };
  const previous = rep[rep.length - 2];
  const delta = latest.price - previous.price;
  return { dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', reason: null, delta, latest, previous };
}

/** The last n calendar days up to the reference date, one entry per day. Missing days stay null (a gap, never filled). */
export function getSeries(commodity, market, n = 7) {
  const e = entryOf(commodity, market);
  const ref = getReferenceDate(commodity);
  if (!e || !ref) return [];
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(ref, -i);
    out.push({ date, price: e.byDate.has(date) ? e.byDate.get(date).price : null });
  }
  return out;
}

function neighbourDistricts(state, district) {
  const listed = NEAR[`${state}|${district}`];
  if (Array.isArray(listed)) return new Set(listed);
  // No neighbour list for this district: fall back to every other district in the same state.
  return new Set(getDistricts().filter((d) => d.state === state && d.district !== district).map((d) => d.district));
}

/**
 * Markets for this commodity in the chosen district and its neighbours, best rate first.
 * Order: reported (highest price first), then no_rate (most recent last-known first), then never reported.
 * Rows without a rate are kept visible at the bottom. Only markets that have a record of this commodity are listed.
 */
export function getNearbyMandis(commodity, { state, district }) {
  const markets = CROP.get(commodity);
  const refDate = getReferenceDate(commodity);
  if (!markets) return { refDate, rows: [] };
  const near = neighbourDistricts(state, district);
  const rows = [];
  for (const { info } of markets.values()) {
    if (info.state !== state) continue;
    const own = info.district === district;
    if (!own && !near.has(info.district)) continue;
    rows.push({ ...info, scope: own ? 'own' : 'near', ...getLatestRate(commodity, info.key), direction: getDirection(commodity, info.key) });
  }
  const rank = (r) => (r.status === 'reported' ? 0 : r.status === 'no_rate' ? 1 : 2);
  rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return b.price - a.price || (a.scope === 'own' ? 0 : 1) - (b.scope === 'own' ? 0 : 1) || a.market.localeCompare(b.market);
    if (rank(a) === 1) return (a.lastKnown.date < b.lastKnown.date ? 1 : a.lastKnown.date > b.lastKnown.date ? -1 : b.lastKnown.price - a.lastKnown.price);
    return a.market.localeCompare(b.market);
  });
  return { refDate, rows };
}

/** Which market the rate card shows first: the best reported rate in the user's own district. */
export function getHeadlineMarket(rows) {
  const own = rows.filter((r) => r.scope === 'own');
  return own.find((r) => r.status === 'reported') || own.find((r) => r.status === 'no_rate') || own[0] || null;
}
