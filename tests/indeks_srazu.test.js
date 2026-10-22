// indeks-srazu-v1 ([Ночные запуски] 23.10.2026): на живом 22–23.10 Индекс в кольце отчёта стоял на «0 / 99»
// (390 и 1280, тёмная и светлая, по ссылке /?inn= и вводом ИНН): число обнулялось заранее, а наблюдатель видимости,
// поставленный во время View Transition, так и не присылал «видно». Итог теперь в разметке сразу, докрутка — только по
// видимости и после перехода, страховка 1 200 мс. Сторож гоняет js/zhivoj-indeks.js на подставном DOM.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const KOD = fs.readFileSync(path.join(__dirname, '..', 'js/zhivoj-indeks.js'), 'utf8');

function uzel(cls) {
  const u = { className: cls || '', children: [], style: { v: {}, setProperty(k, v) { this.v[k] = String(v); } }, attrs: {},
    classList: { s: new Set(), add(c) { this.s.add(c); }, contains(c) { return this.s.has(c); } },
    isConnected: true, offsetWidth: 1, parentNode: null, nextSibling: null, firstChild: null,
    setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener() {}, getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, bottom: 100 }; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, insertBefore(c) { this.children.push(c); c.parentNode = this; return c; },
    querySelector(s) { return s.includes('ot-ix__lv--') ? this.lv || null : null; }, closest() { return null; } };
  return u;
}

function progon({ io, vt, reduce }) {
  const ix = uzel('ot-ix'); const big = uzel('ot-ix__big'); const t = { nodeType: 3, nodeValue: '75' };
  big.firstChild = t; big.parentNode = ix; ix.lv = { className: 'ot-ix__lv ot-ix__lv--ok' };
  const nabl = [], taimery = [];
  const W = {
    matchMedia: (q) => ({ matches: q.includes('no-preference') ? !reduce : !!reduce }),
    requestAnimationFrame: (f) => 0,
    IntersectionObserver: io ? function (cb) { this.observe = () => nabl.push(cb); this.disconnect = () => {}; } : undefined,
    CSS: { supports: () => true }, setTimeout: (f, ms) => taimery.push([f, ms]),
  };
  const d = { activeViewTransition: vt || null, documentElement: uzel(), body: uzel(), createElement: (tag) => uzel(),
    createTextNode: (s) => ({ nodeType: 3, nodeValue: s }),
    querySelectorAll: (s) => (s === '.ot-ix .ot-ix__big' ? [big] : []) };
  vm.runInNewContext(KOD, { window: W, document: d, setTimeout: W.setTimeout, CSS: W.CSS, innerHeight: 800, String, Math });
  const z = ix.children.find((c) => c.attrs['data-zona']);
  return { t, z, nabl, taimery };
}

test('отчёт: Индекс в кольце сразу итоговый — наблюдатель видимости молчит (как на живом во время перехода)', () => {
  const { t, z, taimery } = progon({ io: true });
  assert.ok(z, 'кольцо построено');
  assert.strictEqual(t.nodeValue, '75', 'число не обнуляется заранее');
  assert.strictEqual(z.style.v['--p'], '75', 'дуга — итоговая');
  assert.ok(taimery.some(([, ms]) => ms === 1200), 'страховка 1 200 мс');
});

test('докрутка — только когда кольцо видно, и итог всё равно ставится страховкой', () => {
  const { t, z, nabl, taimery } = progon({ io: true });
  nabl[0]([{ isIntersecting: true }]);
  assert.strictEqual(t.nodeValue, '0', 'видно — докрутка с нуля');
  assert.ok(z.classList.contains('is-idet'));
  for (const [f] of taimery) f();
  assert.strictEqual(t.nodeValue, '75', 'кадры не пришли (вкладка в фоне) — итог по страховке');
  assert.strictEqual(z.style.v['--p'], '75');
});

test('во время View Transition докрутка ждёт transition.finished', async () => {
  let pusk; const vt = { finished: { then(f) { pusk = f; } } };
  const { t, nabl } = progon({ io: true, vt });
  nabl[0]([{ isIntersecting: true }]);
  assert.strictEqual(t.nodeValue, '75', 'пока идёт переход — итог на месте');
  pusk();
  assert.strictEqual(t.nodeValue, '0', 'после перехода — докрутка');
});

test('«Уменьшить движение» — итог сразу, без докрутки', () => {
  const { t, z } = progon({ io: true, reduce: true });
  assert.strictEqual(t.nodeValue, '75');
  assert.strictEqual(z.style.v['--p'], '75');
});
