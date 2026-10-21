// app.js: wiring. Reads the bundled data, asks logic.js what to show, draws it.
// Nothing in the demo path makes a network request for prices: data/*.json come from the cache.

import { setData, getDistricts, getReferenceDate, getNearbyMandis, getHeadlineMarket, getSeries, daysBetween } from './logic.js';
import { t, fmtDate, fmtNum, fmtRupee } from './i18n.js';
import { cropIcon } from './icons.js';

const CONFIG = {
  DEMO: true,        // set to false when data/data.json's prices are the real cleaned snapshot
  STALE_DAYS: 3,     // product decision: banner when the newest report is older than this
};

const state = { lang: 'hi', crop: null, district: null, market: null, crops: [], places: {}, geo: [], nearby: { rows: [], refDate: null } };
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

async function getJSON(path, optional) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path + ' ' + res.status);
    return await res.json();
  } catch (e) {
    if (optional) return {};
    throw e;
  }
}

async function boot() {
  document.body.dataset.ready = '1';
  const q = new URLSearchParams(location.search);
  state.lang = q.get('lang') || store.get('lang') || 'hi';
  if (!['hi', 'en'].includes(state.lang)) state.lang = 'hi';
  bindStatic();
  try {
    const data = await getJSON('data/data.json');
    state.places = { states: {}, districts: {}, markets: data.geography?.market_hi || {} };
    setData(data.prices, data.nearby_districts);
    state.crops = data.commodities;
    buildGeo(data.geography?.states || []);
  } catch (e) {
    $('rateArea').replaceChildren(h('div', { class: 'rate rate--off' }, h('p', { class: 'rate__big' }, L('loadError'))));
    renderChrome();
    return;
  }

  const districts = allDistricts();
  const wantCrop = q.get('crop') || store.get('crop');
  state.crop = state.crops.find((c) => c.name === wantCrop)?.name || state.crops[0]?.name;
  const wantD = q.get('d') || store.get('district');
  state.district = districts.find((d) => `${d.state}|${d.district}` === wantD) || getDistricts()[0] || districts[0] || null;
  state.market = null;

  renderChrome();
  renderCrops();
  renderGeo();
  renderAll();
  registerServiceWorker();
  askForPersistence();
}

function bindStatic() {
  document.querySelectorAll('.lang button').forEach((b) =>
    b.addEventListener('click', () => {
      state.lang = b.dataset.lang;
      store.set('lang', state.lang);
      renderChrome(); renderCrops(); renderGeo(); renderAll();
    }));
  $('state').addEventListener('change', (e) => {
    const list = state.geo.find((g) => g.state === e.target.value)?.districts || [];
    // prefer a district that has a record for this crop, so the first view is not empty
    const withData = list.find((d) => getNearbyMandis(state.crop, { state: e.target.value, district: d.name }).rows.some((r) => r.district === d.name));
    const pick = withData || list[0];
    if (!pick) return;
    setDistrict({ state: e.target.value, district: pick.name });
  });
  $('district').addEventListener('change', (e) => {
    setDistrict({ state: $('state').value, district: e.target.value });
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

function renderCrops() {
  const box = $('crops');
  box.replaceChildren(...state.crops.map((c) =>
    h('button', {
      type: 'button', class: 'crop', 'aria-pressed': String(c.name === state.crop),
      onclick: () => { state.crop = c.name; state.market = null; store.set('crop', c.name); renderCrops(); renderAll(); },
    }, h('span', { html: cropIcon(c.name, c.hi) }), cropName(c))));
}

/* Every state and union territory, with well-known districts (data/data.json: geography.states),
   plus any district that appears in prices.json but is missing from that list. */
function buildGeo(list) {
  const byState = new Map(list.map((g) => [g.state, { state: g.state, hi: g.hi, districts: g.districts.map((d) => ({ ...d })) }]));
  for (const d of getDistricts()) {
    if (!byState.has(d.state)) byState.set(d.state, { state: d.state, hi: state.places.states?.[d.state], districts: [] });
    const g = byState.get(d.state);
    if (!g.districts.some((x) => x.name === d.district)) g.districts.push({ name: d.district, hi: state.places.districts?.[d.district] });
  }
  state.geo = [...byState.values()].sort((a, b) => a.state.localeCompare(b.state));
  for (const g of state.geo) {
    g.districts.sort((a, b) => a.name.localeCompare(b.name));
    state.places.states = { ...(state.places.states || {}), [g.state]: g.hi || state.places.states?.[g.state] || g.state };
    state.places.districts = state.places.districts || {};
    for (const d of g.districts) if (d.hi) state.places.districts[d.name] = d.hi;
  }
}

const allDistricts = () => state.geo.flatMap((g) => g.districts.map((d) => ({ state: g.state, district: d.name })));

function setDistrict(d) {
  state.district = d;
  state.market = null;
  store.set('district', `${d.state}|${d.district}`);
  renderGeo();
  renderAll();
}

function renderGeo() {
  const st = $('state'), di = $('district');
  st.replaceChildren(...state.geo.map((g) => h('option', { value: g.state }, place('states', g.state))));
  if (!state.district) return;
  st.value = state.district.state;
  const list = state.geo.find((g) => g.state === state.district.state)?.districts || [];
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
  if (CONFIG.DEMO) kids.push(h('span', { class: 'chip chip--demo' }, L('demo')));
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

  // No rate on the reference date. Say so first, show the last known rate only as an old, labelled number.
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
