// Run: node --test tests/logic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setData, getLatestRate, getDirection, getNearbyMandis, getSeries, getHeadlineMarket, getReferenceDate, getDistricts } from '../logic.js';

const row = (market, date, modal_price, district = 'D1', state = 'S1', commodity = 'Wheat', arrivals = null) =>
  ({ commodity, state, district, market, date, modal_price, arrivals });

test('missing day is "no_rate", last known rate is returned separately, never carried forward', () => {
  setData([row('A', '2026-10-18', 2400), row('A', '2026-10-19', 2410), row('B', '2026-10-19', 2500), row('B', '2026-10-20', 2520), row('A', '2026-10-20', null)]);
  const a = getLatestRate('Wheat', { state: 'S1', district: 'D1', market: 'A' });
  assert.equal(a.status, 'no_rate');
  assert.equal(a.price, null);
  assert.deepEqual(a.lastKnown, { price: 2410, date: '2026-10-19', arrivals: null });
  assert.equal(a.ageDays, 1);
  assert.equal(getLatestRate('Wheat', { state: 'S1', district: 'D1', market: 'B' }).status, 'reported');
});

test('null, 0 and non-numbers count as not reported', () => {
  setData([row('A', '2026-10-19', 2400), row('A', '2026-10-20', 0), row('B', '2026-10-20', 2500)]);
  assert.equal(getLatestRate('Wheat', 'S1|D1|A').status, 'no_rate');
});

test('direction: up, down, flat, and no previous report', () => {
  setData([
    row('U', '2026-10-19', 100), row('U', '2026-10-20', 110),
    row('D', '2026-10-19', 100), row('D', '2026-10-20', 90),
    row('F', '2026-10-19', 100), row('F', '2026-10-20', 100),
    row('O', '2026-10-20', 100),
  ]);
  assert.equal(getDirection('Wheat', 'S1|D1|U').dir, 'up');
  assert.equal(getDirection('Wheat', 'S1|D1|U').delta, 10);
  assert.equal(getDirection('Wheat', 'S1|D1|D').dir, 'down');
  assert.equal(getDirection('Wheat', 'S1|D1|F').dir, 'flat');
  const one = getDirection('Wheat', 'S1|D1|O');
  assert.equal(one.dir, 'none');
  assert.equal(one.reason, 'no_previous');
});

test('direction compares against the previous REPORTED rate, skipping gaps, and says which date', () => {
  setData([row('A', '2026-10-15', 100), row('A', '2026-10-18', null), row('A', '2026-10-20', 120)]);
  const d = getDirection('Wheat', 'S1|D1|A');
  assert.equal(d.dir, 'up');
  assert.equal(d.previous.date, '2026-10-15');
});

test('nearby: reported sorted high to low, no-rate kept visible at the bottom, never-reported last', () => {
  setData([
    row('Own1', '2026-10-20', 2400, 'D1'), row('Own2', '2026-10-20', 2450, 'D1'),
    row('Near1', '2026-10-20', 2500, 'D2'), row('Gap', '2026-10-18', 2600, 'D2'),
    row('Never', '2026-10-20', null, 'D2'),
    row('Far', '2026-10-20', 9999, 'D9'),
  ], { 'S1|D1': ['D2'] });
  const { rows } = getNearbyMandis('Wheat', { state: 'S1', district: 'D1' });
  assert.deepEqual(rows.map((r) => r.market), ['Near1', 'Own2', 'Own1', 'Gap', 'Never']);
  assert.equal(rows[3].status, 'no_rate');
  assert.equal(rows[4].status, 'none');
});

test('same district name in two states stays separate', () => {
  setData([row('M', '2026-10-20', 100, 'Same', 'S1'), row('M', '2026-10-20', 999, 'Same', 'S2')]);
  const { rows } = getNearbyMandis('Wheat', { state: 'S1', district: 'Same' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 100);
});

test('series leaves gaps as null and is anchored on the reference date', () => {
  setData([row('A', '2026-10-18', 10), row('A', '2026-10-20', 12)]);
  const s = getSeries('Wheat', 'S1|D1|A', 4);
  assert.deepEqual(s.map((x) => x.price), [null, 10, null, 12]);
  assert.equal(s[3].date, '2026-10-20');
});

test('headline market prefers the best reported rate in the own district', () => {
  setData([row('X', '2026-10-20', 100, 'D1'), row('Y', '2026-10-20', 120, 'D1'), row('Z', '2026-10-20', 500, 'D2')], { 'S1|D1': ['D2'] });
  const { rows } = getNearbyMandis('Wheat', { state: 'S1', district: 'D1' });
  assert.equal(getHeadlineMarket(rows).market, 'Y');
});

test('arrivals pass through on a reported rate, and never on a no_rate/never-reported one', () => {
  setData([row('A', '2026-10-19', 2400, 'D1', 'S1', 'Wheat', 180), row('A', '2026-10-20', null, 'D1', 'S1', 'Wheat', 0), row('B', '2026-10-20', 2500, 'D1', 'S1', 'Wheat', 60)]);
  const a = getLatestRate('Wheat', 'S1|D1|A');
  assert.equal(a.status, 'no_rate');
  assert.equal(a.arrivals, null);
  assert.equal(a.lastKnown.arrivals, 180);
  const b = getLatestRate('Wheat', 'S1|D1|B');
  assert.equal(b.arrivals, 60);
});

test('demo dataset: every edge case is present', () => {
  const data = JSON.parse(readFileSync(new URL('../data/data.json', import.meta.url)));
  setData(data.prices, data.nearby_districts);
  assert.equal(getReferenceDate('Wheat'), '2026-10-20');
  const L = 'Uttar Pradesh|Lucknow|';
  assert.equal(getDirection('Wheat', L + 'Lucknow').dir, 'up');
  assert.equal(getLatestRate('Wheat', L + 'Mohanlalganj').status, 'no_rate');
  assert.equal(getDirection('Wheat', 'Uttar Pradesh|Unnao|Unnao').reason, 'no_previous');
  assert.equal(getDirection('Wheat', 'Uttar Pradesh|Barabanki|Barabanki').dir, 'down');
  assert.equal(getDirection('Wheat', 'Uttar Pradesh|Sitapur|Sitapur').dir, 'flat');
  assert.equal(getLatestRate('Wheat', 'Uttar Pradesh|Raebareli|Raebareli').status, 'none');
  assert.ok(getSeries('Wheat', 'Uttar Pradesh|Kanpur Nagar|Kanpur').some((x) => x.price === null));
  assert.ok(getDistricts().length >= 10);
});
