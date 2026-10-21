// frontend/api.js
// Data access layer for the pricy frontend.
// Talks to the FastAPI backend on port 8000 (mounted at /api/v1) and converts
// its responses into the shape logic.js expects:
//   { commodity, state, district, market, date, modal_price }
// The backend (agri/) must not be modified; this module only reads from it.

export const BASE = 'http://localhost:8000/api/v1';

const DAY = 86400000;
const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => new Date(toUTC(s) + n * DAY).toISOString().slice(0, 10);

// A price is "reported" only when it is a positive, finite number.
// null, 0, negative and non-numbers all count as not reported (matches logic.js).
export const isReported = (p) => typeof p === 'number' && Number.isFinite(p) && p > 0;

// Build a query string, skipping undefined / null values so they are not
// sent as literal "key=undefined".
const queryParams = (obj) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v != null) params.append(k, String(v));
  }
  return params.toString();
};

const getJSON = async (path, params = {}) => {
  const qs = queryParams(params);
  const url = qs ? `${path}?${qs}` : path;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
};

/* ---------- fetch layer ---------- */

/** GET /commodities?state= -> { state, commodities: string[], count } */
export const fetchCommodities = (state) => getJSON(`${BASE}/commodities`, { state });

/** GET /states -> { states: string[], count } */
export const fetchStates = () => getJSON(`${BASE}/states`);

/** GET /districts?state= -> { state, districts: string[], count } */
export const fetchDistricts = (state) => getJSON(`${BASE}/districts`, { state });

/**
 * GET /markets?state=&district=&commodity= -> { state, district, markets: string[], count }
 * commodity is optional; omitted when not provided.
 */
export const fetchMarkets = (state, district, commodity) =>
  getJSON(`${BASE}/markets`, { state, district, commodity });

/**
 * GET /prices/latest?state=&district=&commodity=&market=
 * -> { commodity, state, district, markets: [ { market, arrival_date, modal_price, ... } ] }
 * market is optional; omitted when not provided.
 */
export const fetchLatestPrices = (state, district, commodity, market) =>
  getJSON(`${BASE}/prices/latest`, { state, district, commodity, market });

/**
 * GET /prices/history?state=&district=&market=&commodity=&days=
 * -> { state, district, market, commodity, observations: [ { arrival_date, modal_price, ... } ] }
 */
export const fetchPriceHistory = (state, district, market, commodity, days = 14) =>
  getJSON(`${BASE}/prices/history`, { state, district, market, commodity, days });

/** GET /mandis/compare?state=&district=&commodity= -> { state, district, commodity, markets: [...] } */
export const fetchCompareMandis = (state, district, commodity) =>
  getJSON(`${BASE}/mandis/compare`, { state, district, commodity });

/* ---------- transform layer ---------- */

/**
 * Convert a /prices/latest response into logic.js price records.
 * Each market contributes its latest observation plus the previous one, so
 * logic.js can compute direction without a second request. Unreported prices
 * are kept as null so a market that stopped reporting stays visible.
 * @returns {Array<{ commodity, state, district, market, date, modal_price }>}
 */
export const toPriceRecords = (latestResponse, commodity, state, district) => {
  const markets = latestResponse?.markets || [];
  const records = [];
  for (const m of markets) {
    if (!m.arrival_date) continue;
    records.push({
      commodity,
      state,
      district,
      market: m.market,
      date: m.arrival_date,
      modal_price: isReported(m.modal_price) ? m.modal_price : null,
    });
    const prev = m.previous_observation;
    if (prev?.arrival_date) {
      records.push({
        commodity,
        state,
        district,
        market: m.market,
        date: prev.arrival_date,
        modal_price: isReported(prev.modal_price) ? prev.modal_price : null,
      });
    }
  }
  return records;
};

/**
 * Convert a /prices/history response into logic.js price records for one market.
 * Every observation is kept (nulls included) so gaps stay gaps and a market's
 * last known rate survives a run of unreported days.
 * @returns {Array<{ commodity, state, district, market, date, modal_price }>}
 */
export const toPriceRecordsFromHistory = (historyResponse, commodity, state, district, market) =>
  (historyResponse?.observations || [])
    .filter((o) => o.arrival_date)
    .map((o) => ({
      commodity,
      state,
      district,
      market,
      date: o.arrival_date,
      modal_price: isReported(o.modal_price) ? o.modal_price : null,
    }));

/**
 * Convert a /mandis/compare response into a neighbour-district map:
 *   { 'State|District': [neighbour districts] }
 * Best effort: every market in the response tells us its state + district, so
 * we list, for each district, the other districts seen in the same state.
 * @returns {Record<string, string[]>}
 */
export const toNearbyDistricts = (compareResponse) => {
  const byState = new Map();
  for (const m of (compareResponse?.markets || [])) {
    if (!m.state || !m.district) continue;
    if (!byState.has(m.state)) byState.set(m.state, new Set());
    byState.get(m.state).add(m.district);
  }
  const out = {};
  for (const [state, districts] of byState) {
    const list = [...districts].sort();
    for (const d of list) {
      out[`${state}|${d}`] = list.filter((x) => x !== d);
    }
  }
  return out;
};

/**
 * Convert a /prices/history response into a series of { date, price } for the
 * last n days, anchored on the latest observed arrival_date. Days without an
 * observation are price: null (gaps stay gaps, never filled).
 * @returns {Array<{ date: string, price: number | null }>}
 */
export const toSeries = (historyResponse, n = 14) => {
  const observations = historyResponse?.observations || [];
  if (!observations.length) return [];

  const latest = observations.reduce(
    (best, o) => (o.arrival_date && (!best || o.arrival_date > best) ? o.arrival_date : best),
    null,
  );

  const byDate = new Map();
  for (const o of observations) {
    if (!o.arrival_date) continue;
    const price = isReported(o.modal_price) ? o.modal_price : null;
    const prev = byDate.get(o.arrival_date);
    if (prev === undefined || (prev === null && price !== null)) {
      byDate.set(o.arrival_date, price);
    }
  }

  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(latest, -i);
    out.push({ date, price: byDate.get(date) ?? null });
  }
  return out;
};

/* ---------- convenience ---------- */

/**
 * Bootstrap a first view: fetch commodities, then states, then for the first
 * commodity + first state + first district fetch latest prices + history +
 * compare (via the first market). Returns everything in one object.
 */
export const loadAll = async () => {
  const commoditiesRes = await fetchCommodities();
  const statesRes = await fetchStates();
  const commodity = commoditiesRes?.commodities?.[0];
  const state = statesRes?.states?.[0];
  if (!commodity || !state) throw new Error('Backend returned no commodities or states');

  const districtsRes = await fetchDistricts(state);
  const district = districtsRes?.districts?.[0];
  if (!district) throw new Error(`No districts for state ${state}`);

  const marketsRes = await fetchMarkets(state, district, commodity);
  const market = marketsRes?.markets?.[0];
  if (!market) throw new Error(`No markets for ${state} / ${district} / ${commodity}`);

  const [latest, history, compare] = await Promise.all([
    fetchLatestPrices(state, district, commodity, market),
    fetchPriceHistory(state, district, market, commodity),
    fetchCompareMandis(state, district, commodity),
  ]);

  return {
    commodity,
    state,
    district,
    market,
    commodities: commoditiesRes.commodities,
    states: statesRes.states,
    districts: districtsRes.districts,
    markets: marketsRes.markets,
    latest,
    history,
    compare,
  };
};
