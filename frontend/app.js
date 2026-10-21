// app.js: wiring. Reads prices from the FastAPI backend (agri/, port 8000)
// via api.js, asks logic.js what to show, draws it.
// Nothing makes a network request except to the local backend.

import { setData, getReferenceDate, getNearbyMandis, getHeadlineMarket, getSeries, daysBetween } from './logic.js';
import { t, fmtDate, fmtNum, fmtRupee } from './i18n.js';
import { cropIcon } from './icons.js';
import {
  fetchCommodities,
  fetchStates,
  fetchDistricts,
  fetchMarkets,
  fetchPriceHistory,
  toPriceRecordsFromHistory,
} from './api.js';

const CONFIG = {
  DEMO: false,        // data now comes from the real backend API
  STALE_DAYS: 3,      // product decision: banner when the newest report is older than this
  HISTORY_DAYS: 30,   // one history request per market covers the trend + previous report
  CONCURRENCY: 8,     // backend requests are small; keep the browser from flooding it
  FEATURED: ['Wheat', 'Paddy(Common)', 'Maize', 'Mustard', 'Potato', 'Onion', 'Tomato', 'Soyabean'],
  FILLER: ['Rice', 'Bajra(Pearl Millet/Cumbu)', 'Groundnut', 'Banana', 'Brinjal', 'Cabbage', 'Carrot', 'Cauliflower', 'Green Chilli', 'Garlic', 'Ginger(Green)', 'Peas(Dry)'],
};

// The backend names its commodities exactly; fall back to a prefix match if a name shifts.
const featuredCrops = () => {
  const picks = [];
  const add = (want) => {
    const hit = state.crops.find((c) => c.name.toLowerCase() === want.toLowerCase())
      || state.crops.find((c) => c.name.toLowerCase().startsWith(want.toLowerCase()));
    if (hit && !picks.includes(hit)) picks.push(hit);
  };
  CONFIG.FEATURED.forEach(add);
  for (const want of CONFIG.FILLER) {
    if (picks.length >= CONFIG.FEATURED.length) break;
    add(want);
  }
  for (const c of state.crops) {
    if (picks.length >= CONFIG.FEATURED.length) break;
    if (!picks.includes(c)) picks.push(c);
  }
  return picks;
};

// Eight chips max: the featured crops, with the chosen crop swapped in when it is not featured.
const visibleCrops = () => {
  const picks = featuredCrops().slice(0, CONFIG.FEATURED.length);
  const selected = state.crops.find((c) => c.name === state.crop);
  if (selected && !picks.includes(selected)) {
    if (picks.length >= CONFIG.FEATURED.length) picks[picks.length - 1] = selected;
    else picks.push(selected);
  }
  return picks;
};

// Loose subsequence match: "pt" finds Potato, "onon" finds Onion.
function fuzzyScore(text, query) {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const at = t.indexOf(q);
  if (at === 0) return 1000 - t.length;
  if (at > 0) return 800 - at - t.length * 0.01;
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === ' ') { streak = 0; continue; }
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    score += streak > 0 ? 8 : 2;
    streak++;
    ti = found + 1;
  }
  return 300 + score - t.length * 0.01;
}

const state = {
  lang: 'hi',
  crop: null,
  district: null,
  market: null,
  crops: [],          // [{ name, hi }]
  places: { states: {}, districts: {}, markets: {} },
  geo: [],            // { state, hi, districts: [{name, hi}] } — one entry per backend state
  nearby: { rows: [], refDate: null },
  records: [],        // price records built from the backend, all markets for crop + state
  nearbyMap: {},      // "State|District" -> other districts in the same state
  loadedKey: null,    // `${crop}|${state}` covered by state.records
};
const $ = (id) => document.getElementById(id);

/* ---------- small helpers ---------- */

const store = {
  get: (k) => { try { return localStorage.getItem('abh.' + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('abh.' + k, v); } catch { /* private mode: fine */ } },
};

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}

// Run fn over items with a bounded number of in-flight requests.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const todayLocal = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in the phone's own time zone
const L = (k, v) => t(state.lang, k, v);
const D = (iso, short) => fmtDate(state.lang, iso, short);

function place(kind, name) {
  return state.lang === 'hi' ? (state.places[kind]?.[name] || name) : name;
}
const cropName = (c) => (state.lang === 'hi' ? c.hi : c.en) || c.name;
const mandiName = (r) => (state.lang === 'hi' ? `${place('markets', r.market)} मंडी` : `${r.market} mandi`);
const districtName = (r) => (state.lang === 'hi' ? `${place('districts', r.district)} ज़िला` : `${r.district} district`);

const ARROW = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 23 21H1Z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 1 3h22Z" fill="currentColor"/></svg>',
  flat: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="4.5" rx="1.5" fill="currentColor"/><rect x="2" y="13.5" width="20" height="4.5" rx="1.5" fill="currentColor"/></svg>',
  none: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="4" rx="1.5" fill="currentColor"/></svg>',
};

/* ---------- boot ---------- */

async function boot() {
  document.body.dataset.ready = '1';
  const q = new URLSearchParams(location.search);
  state.lang = q.get('lang') || store.get('lang') || 'hi';
  if (!['hi', 'en'].includes(state.lang)) state.lang = 'hi';
  bindStatic();
  try {
    // States: backend returns string[]. Load ALL into state.geo so the picker shows every state.
    const statesRes = await fetchStates();
    const states = statesRes.states || [];
    if (!states.length) throw new Error('Backend returned no states');
    state.geo = states.map((s) => ({ state: s, hi: s, districts: [] }));

    // Prefer a state where the featured crops actually report, so the first view is not empty.
    const fallbackState = states.includes('Uttar Pradesh') ? 'Uttar Pradesh' : states[0];
    const wantState = q.get('state') || store.get('state') || fallbackState;
    const wantCrop = q.get('crop') || store.get('crop');

    // Crops are state-specific: only offer what this state actually reports.
    await setCropsForState(wantState, wantCrop);
    await loadStateAndDistrict(wantState, q.get('district') || store.get('district'));
  } catch (e) {
    $('rateArea').replaceChildren(h('div', { class: 'rate rate--off' }, h('p', { class: 'rate__big' }, L('loadError'))));
    renderChrome();
    return;
  }

  renderChrome();
  renderCrops();
  renderGeo();
  renderAll();
  registerServiceWorker();
  askForPersistence();
}

/** Load the crops this state actually reports, keeping the chosen crop when it is available. */
async function setCropsForState(wantState, wantCrop) {
  const res = await fetchCommodities(wantState);
  const names = res.commodities || [];
  if (!names.length) throw new Error(`Backend returned no commodities for ${wantState}`);
  state.crops = names.map((n) => ({ name: n, hi: n }));
  state.crop = state.crops.find((c) => c.name === wantCrop)?.name
    || featuredCrops()[0]?.name
    || state.crops[0].name;
  store.set('crop', state.crop);
}

/** Ensure districts for `wantState` are loaded (fetch on demand), then set the district. */
async function loadStateAndDistrict(wantState, wantDistrict) {
  let g = state.geo.find((x) => x.state === wantState);
  if (!g) {
    g = { state: wantState, hi: wantState, districts: [] };
    state.geo.push(g);
    state.geo.sort((a, b) => a.state.localeCompare(b.state));
  }

  // Fetch districts for this state only if we haven't yet.
  if (!g.districts.length) {
    const districtsRes = await fetchDistricts(wantState);
    g.districts = (districtsRes.districts || []).map((d) => ({ name: d, hi: d }));
  }

  let district;
  if (wantDistrict) {
    district = { state: wantState, district: wantDistrict };
  } else {
    district = { state: wantState, district: g.districts[0]?.name || null };
  }
  state.district = district;
  store.set('state', wantState);
  if (district.district) store.set('district', `${wantState}|${district.district}`);

  await loadPricesForCurrentSelection();
}

/** (Re)fetch prices for the current crop + district and re-set logic.js data. */
async function loadPricesForCurrentSelection() {
  if (!state.crop || !state.district) return;
  const st = state.district.state;
  const key = `${state.crop}|${st}`;

  if (state.loadedKey !== key) {
    const g = state.geo.find((x) => x.state === st);
    const districts = (g?.districts || []).map((d) => d.name);

    // Every district in the state is a neighbour; logic.js ranks own-district rows first.
    state.nearbyMap = Object.fromEntries(
      districts.map((d) => [`${st}|${d}`, districts.filter((x) => x !== d)]),
    );

    // Discover the markets that actually carry this commodity, district by district.
    const perDistrict = await mapLimit(districts, CONFIG.CONCURRENCY, async (district) => {
      const res = await fetchMarkets(st, district, state.crop);
      return (res.markets || []).map((market) => ({ district, market }));
    });
    const markets = perDistrict.flat();

    // History (not /latest) gives us gaps, last-known rates and direction in one call.
    const perMarket = await mapLimit(markets, CONFIG.CONCURRENCY, async ({ district, market }) => {
      const res = await fetchPriceHistory(st, district, market, state.crop, CONFIG.HISTORY_DAYS);
      return toPriceRecordsFromHistory(res, state.crop, st, district, market);
    });

    state.records = perMarket.flat();
    state.loadedKey = key;
  }

  setData(state.records, state.nearbyMap);
}

function bindStatic() {
  $('cropDialogClose').addEventListener('click', closeCropDialog);
  $('cropSearch').addEventListener('input', renderCropResults);
  $('cropDialog').addEventListener('click', (e) => { if (e.target === $('cropDialog')) closeCropDialog(); });
  $('cropDialog').addEventListener('close', () => { $('cropSearch').value = ''; });
  document.querySelectorAll('.lang button').forEach((b) =>
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      store.set('lang', state.lang);
      renderChrome(); renderCrops(); renderGeo(); renderAll();
    }));
  $('state').addEventListener('change', async (e) => {
    const wantState = e.target.value;
    store.set('state', wantState);
    state.district = null;
    state.market = null;
    await setCropsForState(wantState, state.crop);
    await loadStateAndDistrict(wantState, null);
    renderCrops(); renderGeo(); renderAll();
  });
  $('district').addEventListener('change', async (e) => {
    await setDistrict({ state: $('state').value, district: e.target.value });
  });
  window.addEventListener('online', renderNotes);
  window.addEventListener('offline', renderNotes);
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e;
    $('install').hidden = false;
  });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt(); await deferred.userChoice; deferred = null; $('install').hidden = true;
  });
}

/* ---------- static text, pickers ---------- */

function renderChrome() {
  document.documentElement.lang = state.lang;
  document.title = L('appName');
  $('appName').textContent = L('appName');
  $('tagline').textContent = L('tagline');
  $('cropLabel').textContent = L('pickCrop');
  $('stateLabel').textContent = L('pickState');
  $('districtLabel').textContent = L('pickDistrict');
  $('nearbyTitle').textContent = L('nearbyTitle');
  $('nearbyHint').textContent = L('nearbyHint');
  $('source').textContent = L('source');
  $('modalNote').textContent = L('modalNote');
  $('persistNote').textContent = L('persistRefused');
  $('install').textContent = L('install');
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
}

async function selectCrop(name) {
  closeCropDialog();
  if (!name || name === state.crop) { renderCrops(); renderAll(); return; }
  state.crop = name;
  state.market = null;
  store.set('crop', name);
  await loadPricesForCurrentSelection();
  renderCrops();
  renderAll();
}

function renderCrops() {
  const box = $('crops');
  const chips = visibleCrops().map((c) =>
    h('button', {
      type: 'button', class: 'crop', 'aria-pressed': String(c.name === state.crop),
      onclick: () => selectCrop(c.name),
    }, h('span', { html: cropIcon(c.name, c.hi) }), cropName(c)));
  chips.push(h('button', {
    type: 'button', class: 'crop crop--more', onclick: openCropDialog,
  }, h('span', { class: 'crop__more-icon', 'aria-hidden': 'true' }, '+'), L('moreCrops')));
  box.replaceChildren(...chips);
}

/* ---------- all-crops dialog ---------- */

function openCropDialog() {
  const dialog = $('cropDialog');
  $('cropDialogTitle').textContent = L('allCrops');
  $('cropSearch').placeholder = L('searchCrops');
  $('cropSearch').setAttribute('aria-label', L('searchCrops'));
  $('cropDialogClose').setAttribute('aria-label', L('close'));
  $('cropEmpty').textContent = L('noCropsFound');
  $('cropSearch').value = '';
  renderCropResults();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  $('cropSearch').focus();
}

function closeCropDialog() {
  const dialog = $('cropDialog');
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function renderCropResults() {
  const query = $('cropSearch').value;
  const ranked = state.crops
    .map((c) => ({ crop: c, score: fuzzyScore(c.name, query) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.crop.name.localeCompare(b.crop.name));

  $('cropResults').replaceChildren(...ranked.map(({ crop: c }) =>
    h('li', {},
      h('button', {
        type: 'button', class: 'crop-result', 'aria-pressed': String(c.name === state.crop),
        onclick: () => selectCrop(c.name),
      }, h('span', { html: cropIcon(c.name, c.hi) }), cropName(c)))));
  $('cropEmpty').hidden = ranked.length > 0;
}

/* Build the state/district picker from all loaded states. */
function buildGeo() {
  state.geo = [...state.geo].sort((a, b) => a.state.localeCompare(b.state));
  for (const g of state.geo) {
    g.districts.sort((a, b) => a.name.localeCompare(b.name));
    state.places.states = { ...(state.places.states || {}), [g.state]: g.hi || state.places.states?.[g.state] || g.state };
    state.places.districts = state.places.districts || {};
    for (const d of g.districts) if (d.hi) state.places.districts[d.name] = d.hi;
  }
}

const allDistricts = () => state.geo.flatMap((g) => g.districts.map((d) => ({ state: g.state, district: d.name })));

async function setDistrict(d) {
  state.district = d;
  state.market = null;
  store.set('district', `${d.state}|${d.district}`);
  await loadPricesForCurrentSelection();
  renderGeo();
  renderAll();
}

function renderGeo() {
  const st = $('state'), di = $('district');
  st.replaceChildren(...state.geo.map((g) => h('option', { value: g.state }, place('states', g.state))));
  if (!state.district) return;
  st.value = state.district.state;
  const g = state.geo.find((x) => x.state === state.district.state);
  const list = g ? g.districts : [];
  di.replaceChildren(...list.map((d) => h('option', { value: d.name }, place('districts', d.name))));
  di.value = state.district.district;
}

/* ---------- main render ---------- */

function renderAll() {
  if (!state.crop || !state.district) return;
  state.nearby = getNearbyMandis(state.crop, state.district);
  const rows = state.nearby.rows;
  if (!state.market || !rows.some((r) => r.key === state.market)) state.market = getHeadlineMarket(rows)?.key || null;
  renderNotes();
  renderRate();
  renderList();
  renderTrend();
}

function renderNotes() {
  const ref = state.nearby.refDate || (state.crop && getReferenceDate(state.crop));
  const box = $('notes');
  const kids = [];
  if (ref) kids.push(h('p', { class: 'snap' }, `${L('snapshot', { date: D(ref) })} · ${L('notLive')}`));
  if (navigator.onLine === false) kids.push(h('span', { class: 'chip' }, L('offline')));
  if (ref) {
    const age = daysBetween(ref, todayLocal());
    if (age > CONFIG.STALE_DAYS) kids.push(h('p', { class: 'stale' }, L('stale', { n: age, date: D(ref) })));
  }
  box.replaceChildren(...kids);
}

function dirBlock(row, onDark = true) {
  const d = row.direction;
  if (d.dir === 'none') return h('div', { class: 'rate__dir rate__dir--none' }, h('span', { html: ARROW.none }), h('b', {}, L('noPrevious')));
  const word = L(d.dir);
  const amount = d.dir === 'flat' ? '' : ` ${fmtRupee(Math.abs(d.delta))}`;
  return h('div', { class: `rate__dir rate__dir--${d.dir}` },
    h('span', { html: ARROW[d.dir] }),
    h('div', {}, h('b', {}, d.dir === 'flat' ? word : word + amount), h('span', {}, L('vsDate', { date: D(d.previous.date) }))));
}

function renderRate() {
  const area = $('rateArea');
  const row = state.nearby.rows.find((r) => r.key === state.market);

  if (!row) {
    area.replaceChildren(h('div', { class: 'rate rate--off' },
      h('p', { class: 'rate__big' }, L('noRecords')),
      state.nearby.rows.length ? h('p', { class: 'rate__sub' }, L('noRecordsHint')) : null));
    return;
  }

  const where = h('p', { class: 'rate__where' }, mandiName(row), ' ', h('span', {}, '· ' + districtName(row)));

  if (row.status === 'reported') {
    area.replaceChildren(h('div', { class: 'rate rate--on' },
      where,
      h('p', { class: 'rate__kicker' }, `${L('latestReported')} · ${D(row.date)}`),
      h('p', { class: 'rate__num', 'aria-label': `${fmtNum(row.price)} ${L('perQuintal')}` }, h('small', { 'aria-hidden': 'true' }, '₹'), h('span', {}, fmtNum(row.price))),
      h('p', { class: 'rate__unit' }, L('perQuintal')),
      dirBlock(row)));
    return;
  }

  const card = h('div', { class: 'rate rate--off' },
    where,
    h('p', { class: 'rate__big' }, L('noRate')),
    h('p', { class: 'rate__sub' }, row.status === 'none' ? L('neverReported') : L('noRateOn', { date: D(row.refDate) })));
  if (row.status === 'no_rate') {
    card.append(h('div', { class: 'old' },
      h('span', { class: 'old__tag' }, L('oldRate')),
      h('span', { class: 'old__num' }, fmtRupee(row.lastKnown.price), ' ', h('small', {}, L('perQuintal'))),
      h('span', { class: 'old__when' }, `${D(row.lastKnown.date)} · ${L('daysAgo', { n: row.ageDays })}`)));
  }
  area.replaceChildren(card);
}

function miniDir(d) {
  if (d.dir === 'none') return null;
  const txt = d.dir === 'flat' ? L('flat') : `${L(d.dir)} ${fmtRupee(Math.abs(d.delta))}`;
  return h('span', { class: `dir dir--${d.dir}` }, h('span', { html: ARROW[d.dir] }), txt);
}

function renderList() {
  const list = $('list');
  const rows = state.nearby.rows;
  if (!rows.length) { list.replaceChildren(h('li', { class: 'empty' }, L('noNearby'))); return; }
  const reported = rows.filter((r) => r.status === 'reported');
  list.replaceChildren(...rows.map((r) => {
    const off = r.status !== 'reported';
    const best = !off && reported.length > 1 && r === reported[0];
    const meta = [];
    if (best) meta.push(h('span', { class: 'tag' }, L('best')));
    if (r.scope === 'own') meta.push(h('span', { class: 'tag tag--own' }, L('yourDistrict')));
    else meta.push(h('span', {}, districtName(r)));
    if (r.status === 'reported') { meta.push(h('span', {}, D(r.date, true))); const m = miniDir(r.direction); if (m) meta.push(m); }
    if (r.status === 'no_rate') meta.push(h('span', { class: 'tag tag--old' }, L('old')), h('span', {}, `${fmtRupee(r.lastKnown.price)} · ${D(r.lastKnown.date, true)}`));
    return h('li', {},
      h('button', {
        type: 'button', class: `row${off ? ' row--off' : ''}`, 'aria-pressed': String(r.key === state.market),
        'aria-label': `${mandiName(r)}. ${off ? L('noRate') : fmtNum(r.price) + ' ' + L('perQuintal')}`,
        onclick: () => pickMarket(r.key),
      },
      h('div', {}, h('div', { class: 'row__name' }, mandiName(r)), h('div', { class: 'row__meta' }, meta)),
      off ? h('div', { class: 'row__price row__price--off' }, L('noRate')) : h('div', { class: 'row__price' }, fmtRupee(r.price))));
  }));
}

function pickMarket(key) {
  state.market = key;
  renderRate(); renderList(); renderTrend();
  if (matchMedia('(max-width: 899px)').matches) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('rateArea').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

/* ---------- 7-day trend: gaps stay gaps ---------- */

function renderTrend() {
  const area = $('trendArea');
  const row = state.nearby.rows.find((r) => r.key === state.market);
  if (!row || row.status === 'none') { area.replaceChildren(); return; }
  const series = getSeries(state.crop, row.key, 7);
  const vals = series.map((s) => s.price).filter((p) => p !== null);
  if (!vals.length) { area.replaceChildren(); return; }

  const W = 336, padX = 22, top = 30, bottom = 108;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.max(10, lo * 0.02);
  const x = (i) => padX + (i * (W - padX * 2)) / (series.length - 1);
  const y = (p) => bottom - ((p - (lo - span * 0.15)) / (span * 1.3)) * (bottom - top);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };

  const svg = el('svg', { viewBox: `0 0 ${W} 150`, role: 'img', 'aria-label': `${L('last7')}: ${vals.map(fmtNum).join(', ')}` });
  const lastIdx = series.map((s) => s.price !== null).lastIndexOf(true);
  series.forEach((s, i) => {
    if (s.price !== null && i > 0 && series[i - 1].price !== null)
      svg.append(el('line', { x1: x(i - 1), y1: y(series[i - 1].price), x2: x(i), y2: y(s.price), stroke: '#14532D', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
  });
  series.forEach((s, i) => {
    if (s.price === null) {
      svg.append(el('rect', { x: x(i) - 9, y: bottom - 5, width: 18, height: 10, rx: 3, fill: 'none', stroke: '#435449', 'stroke-width': 2, 'stroke-dasharray': '3 3' }));
    } else {
      svg.append(el('circle', { cx: x(i), cy: y(s.price), r: i === lastIdx ? 7 : 5, fill: '#14532D' }));
    }
    svg.append(el('text', { x: x(i), y: 138, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: s.price === null ? '#435449' : '#14221A' }, String(Number(s.date.slice(8)))));
  });
  const firstIdx = series.findIndex((s) => s.price !== null);
  const label = (i) => svg.append(el('text', { x: Math.min(Math.max(x(i), 34), W - 34), y: y(series[i].price) - 12, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: '#14221A' }, '\u20B9' + fmtNum(series[i].price)));
  label(lastIdx);
  if (firstIdx !== lastIdx) label(firstIdx);

  const reportedDays = series.filter((s) => s.price !== null);
  const f = reportedDays[0], l = reportedDays[reportedDays.length - 1];
  let summary = L('trendOne');
  if (reportedDays.length > 1) {
    const diff = l.price - f.price;
    const v = { d1: D(f.date), d2: D(l.date), p1: fmtNum(f.price), p2: fmtNum(l.price), n: fmtNum(Math.abs(diff)), word: L(diff > 0 ? 'up' : 'down') };
    summary = diff === 0 ? L('trendFlat', v) : L('trendChange', v);
  }
  const crop = state.crops.find((c) => c.name === state.crop);
  area.replaceChildren(h('div', { class: 'trend' },
    h('h2', {}, L('trendTitle', { crop: crop ? cropName(crop) : state.crop }),
      h('span', {}, `${mandiName(row)} · ${D(series[0].date)} \u2013 ${D(series[series.length - 1].date)}`)),
    h('p', { class: 'unit' }, L('trendUnit')),
    svg,
    h('p', { class: 'sum' }, summary),
    series.some((s) => s.price === null) ? h('p', {}, L('gapNote')) : null));
}

/* ---------- offline + install ---------- */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* app still works online */ });
}

async function askForPersistence() {
  try {
    if (!navigator.storage?.persist) return;
    const ok = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    const installed = matchMedia('(display-mode: standalone)').matches;
    const note = $('persistNote');
    note.textContent = L('persistRefused');
    note.hidden = ok || installed;
  } catch { /* ignore */ }
}

boot();
