// obrazec-pasporta-v1: образец Паспорта контрагента (/pasport/kontragent/?demo=1) не спорит сам с собой.
// Живой образец 25.10: раздел 6 — «Выручка по годам … 2025 — 61 400 000 ₽», а раздел 14 — «выручки в отчётности нет —
// берём потолок по возрасту»; раздел 7 — «Долги по налогам — нет (ФНС, на 01.09.2026)», а оговорка 14 — «не проверяли
// … долги по налогам». Причина — образец был собран не в форме живого ответа API: выручка только в charts (без KPI
// «Выручка за 2025»), строка налогов без id tax_debt. Сторож берёт данные образца прямо из страницы.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));

function obrazec() {
  const h = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  const m = /if\(demo\)\{[\s\S]*?r\.dossier=(\{[\s\S]*?\});\n/.exec(h);
  assert.ok(m, 'в странице есть данные образца (r.dossier=…)');
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = '2026-10-25T22:00:00+03:00';               // дата проверки фиксирована: набор ФНС 01.10 — свежий
  r.dossier = Function('return ' + m[1])();
  return P.sobrat(r, { usloviya: U, indeksVorota: IV, nomer: 'ОБРАЗЕЦ' });
}
const razdel = (p, id) => p.razdely.find((x) => x.id === id);
const tekst = (x) => x.fakty.map((f) => f.tekst + ' ' + f.znachenie).join(' | ').replace(/[\s\u00a0\u202f]+/g, ' ');

test('выручка из раздела 6 — она же в расчёте предела аванса (раздел 14)', () => {
  const p = obrazec(), predel = tekst(razdel(p, 'predel'));
  assert.doesNotMatch(predel, /выручки в отчётности нет/, predel);
  assert.match(predel, /выручка за 2025 — 61[\s ]400[\s ]000 ₽ ÷ 26/, predel);
});

test('долги по налогам, показанные в разделе 7, не попадают в «не проверяли» раздела 14', () => {
  const p = obrazec(), predel = tekst(razdel(p, 'predel'));
  const ogovorka = (/Оговорка (.*)/.exec(predel) || [])[1] || '';
  const neProv = (/не проверяли ([^.]*)/.exec(ogovorka) || [])[1] || '';
  assert.doesNotMatch(neProv, /налог/, ogovorka);
  assert.match(ogovorka, /Долги по налогам — нет в списке ФНС на 01\.10\.2026/, ogovorka);
});

test('образец в форме живого ответа API: KPI «Выручка за ГГГГ» = последнему году ряда, строка налогов с id tax_debt', () => {
  const h = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  const d = Function('return ' + /if\(demo\)\{[\s\S]*?r\.dossier=(\{[\s\S]*?\});\n/.exec(h)[1])();
  const posl = d.charts.revenue[d.charts.revenue.length - 1];
  const kpi = d.kpi.find((k) => /^Выручка за \d{4}$/.test(k.label));
  assert.ok(kpi, 'KPI выручки');
  assert.deepStrictEqual([kpi.label, kpi.value], ['Выручка за ' + posl.year, posl.value]);
  const nal = E.DEMO.signals.filter((s) => /налогам/.test(s.title));
  assert.strictEqual(nal.length, 1);
  assert.strictEqual(nal[0].id, 'tax_debt');
});
