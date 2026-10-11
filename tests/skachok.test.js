// skachok-v1 [Ночные-3] 10.10 — «Скачок в отчётности» в блоке «Динамика» экрана проверки (js/dinamika.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');

function otvet({ rev, aktDelta, aktValue = 212832135000, balGod = 2025 }) {
  const kpi = [];
  if (aktDelta !== undefined) kpi.push({ label: 'Активы', value: aktValue, delta: aktDelta, good_up: true });
  return { checked_at: '2026-10-10T17:22:00Z', dossier: { kpi, charts: { revenue: rev || [], balance: { year: balGod, equity: 1, long_debt: 1, short_debt: 1 } } } };
}
const RYAD = (vals) => vals.map((v, i) => ({ year: 2021 + i, value: v }));

test('активы ×3,9 (живой ответ 10.10: delta 294) — нейтральный тон, факт и оговорка о причинах', () => {
  const s = D.skachok(otvet({ rev: RYAD([41e9, 42e9, 48e9, 51.26e9, 90.2e9]), aktDelta: 294 }));
  assert.ok(s);
  assert.strictEqual(s.ton, 'ro');
  assert.match(s.tekst, /Активы на 31\.12\.2025 — в 3,9 раза больше, чем годом раньше\./);
  // [Право] 11.10: «например» — без него список причин читается как закрытый
  assert.match(s.tekst, /Так бывает, например, при присоединении другой компании/);
  assert.doesNotMatch(s.tekst, /Выручка/, 'рост выручки на 76 % — не скачок');
});

test('выручка вдвое и больше — факт с годами; падение на 50 % и больше — тон «внимание» и вопрос до аванса', () => {
  const up = D.skachok(otvet({ rev: RYAD([10e6, 12e6, 30e6]) }));
  assert.match(up.tekst, /Выручка за 2023 год — в 2,5 раза больше, чем за 2022\./);
  const down = D.skachok(otvet({ rev: RYAD([100e6, 90e6, 38e6]) }));
  assert.strictEqual(down.ton, 'warn');
  assert.match(down.tekst, /на 58 % меньше, чем за 2022\./);
  assert.match(down.tekst, /Перед авансом спросите компанию, что изменилось\./);
  assert.doesNotMatch(down.tekst, /присоединении/);
});

test('активы упали на 50 % и больше — проценты, а не «в N раз» (delta от API округлена)', () => {
  const s = D.skachok(otvet({ aktDelta: -62 }));
  assert.strictEqual(s.ton, 'warn');
  assert.match(s.tekst, /на 62 % меньше, чем годом раньше/);
});

test('без скачка, малая база, разрыв в годах, нет данных — блока нет', () => {
  assert.strictEqual(D.skachok(otvet({ rev: RYAD([10e6, 15e6, 19e6]), aktDelta: 60 })), null);
  assert.strictEqual(D.skachok(otvet({ rev: RYAD([200e3, 900e3, 5e6]) })), null, 'база меньше 1 млн ₽ — шум');
  assert.strictEqual(D.skachok(otvet({ rev: [{ year: 2021, value: 10e6 }, { year: 2023, value: 40e6 }] })), null, 'годы не соседние');
  assert.strictEqual(D.skachok(otvet({ aktDelta: null })), null);
  assert.strictEqual(D.skachok({}), null);
  assert.strictEqual(D.skachok(null), null);
  assert.strictEqual(D.skachokHtml({}), '');
});

test('в разметке «Динамики» — после выводов, до баланса; без превосходных степеней и обещаний', () => {
  const r = otvet({ rev: RYAD([41e9, 42e9, 48e9, 51.26e9, 90.2e9]), aktDelta: 294 });
  r.dossier.charts.profit = RYAD([1e9, 2e9, -5e8, 2.4e9, 2.7e9]);
  const h = D.htmlDinamika(r);
  const i = h.indexOf('data-blok="skachok"');
  assert.ok(i > h.indexOf('din__tr'), 'после строки выводов');
  assert.ok(i < h.indexOf('din__src'), 'до источника');
  assert.match(h, /<b>Скачок в отчётности\.<\/b>/);
  const t = D.skachok(r).tekst;
  assert.doesNotMatch(t, /лучш|надёжн|гарант|точно|обязательно/i);
});

test('стиль блока — в CSS модуля, тон «внимание» — токенами предупреждения', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dinamika.js'), 'utf8');
  assert.match(src, /\.din__skachok\{/);
  assert.match(src, /\.din__skachok--warn\{background:var\(--warn-bg/);
});
