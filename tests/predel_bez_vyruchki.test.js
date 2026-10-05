// predel-bez-vyruchki-v1 [Ночные-3] 05.10 — ТЗ [Продукт · Данные] 05.10 разд. 1.
// Отчёт за год в ГИР БО сдан, выручки в нём нет → выручка известна и равна 0: две недели нулевой выручки — 0 ₽,
// «советуем платить по факту». Потолок по возрасту — только для компаний без отчётности в открытых данных.
// Живой пример (ООО, 16 лет, штат 0, капитал −11,1 млн ₽, 3 замечания) показывал «Можно, предоплата — до 1 500 000 ₽».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const U = require('../js/usloviya.js');
const S = require('../js/sushchestvennoe.js');
const KOREN = path.join(__dirname, '..');

function otvet(dossier, o) {
  o = o || {};
  return { checked_at: '2026-10-05', risk_level: o.level || 'medium',
    company: { inn: '7800000001', kind: 'LEGAL', name_short: 'ООО «Тест»', status: o.status || 'ACTIVE', reg_date: o.reg || '2009-11-25', okved: '43.11' },
    signals: o.signals || [], dossier: dossier };
}
const OTCHET_NULL = { kpi: [{ label: 'Выручка за 2025', value: null }, { label: 'Чистая прибыль за 2025', value: -2100000 }],
  charts: { revenue: [], profit: [{ year: 2024, value: -245000 }, { year: 2025, value: -2100000 }], balance: { year: 2025, equity: -11058000 } } };
const OTCHET_NOL = { kpi: [{ label: 'Выручка за 2025', value: 0 }],
  charts: { revenue: [{ year: 2025, value: 0 }], profit: [{ year: 2025, value: -50000 }], balance: { year: 2025, equity: 10000 } } };
const TRI = [ // 3 предупреждения — тон «cap» → было «половина потолка по возрасту»
  { title: 'Задолженность по налогам', status: 'warn', detail: '1 937 ₽' },
  { title: 'Среднесписочная численность', status: 'warn', detail: '0' },
  { title: 'Административные штрафы', status: 'warn', detail: 'есть' }];

test('(а) отчёт есть, выручка null, 16 лет, «можно с пределом» → 0 ₽, по факту, «выручки в нём нет»', () => {
  const r = otvet(OTCHET_NULL, { signals: TRI.slice(0, 2) });
  const d = U.decide(r);
  assert.strictEqual(d.tone, 'cap');
  assert.strictEqual(d.cap, 0);
  assert.strictEqual(d.malo, true);
  assert.strictEqual(d.raschet.base, 'nol');
  assert.strictEqual(d.headline, 'Можно, оплата — по факту поставки');
  const k = d.kak.kak;
  assert.match(k, /Как посчитали: отчёт за 2025 в ГИР БО есть, но выручки в нём нет\. Две недели нулевой выручки — 0 ₽, поэтому советуем платить по факту поставки\./);
});

test('(б) то же с выручкой 0', () => {
  const f = U.facts(otvet(OTCHET_NOL));
  assert.strictEqual(f.vyruchkaNol, true);
  const pc = U.prepayCap(f, 'go');
  assert.strictEqual(pc.cap, 0); assert.strictEqual(pc.malo, true);
});

test('(в) отчёта нет, 16 лет → потолок по возрасту, как раньше', () => {
  const f = U.facts(otvet({ kpi: [], charts: {} }));
  assert.ok(!f.vyruchkaNol);
  assert.strictEqual(U.prepayCap(f, 'go').cap, 3000000);
  assert.strictEqual(U.prepayCap(f, 'cap').cap, 1500000);
  assert.strictEqual(U.prepayCap(f, 'go').raschet.base, 'age');
});

test('(г) выручка > 0 → без изменений (÷ 26)', () => {
  const d = { kpi: [{ label: 'Выручка за 2025', value: 13000000 }], charts: { revenue: [{ year: 2025, value: 13000000 }], profit: [{ year: 2025, value: 100000 }], balance: { year: 2025, equity: 5 } } };
  const f = U.facts(otvet(d));
  assert.ok(!f.vyruchkaNol);
  const pc = U.prepayCap(f, 'go');
  assert.strictEqual(pc.raschet.base, 'revenue');
  assert.strictEqual(pc.cap, 500000); // 13 000 000 ÷ 26 = 500 000
});

test('(д) младше года, отчёт без выручки → 0', () => {
  const f = U.facts(otvet(OTCHET_NULL, { reg: '2025-12-01' }));
  assert.ok(f.ageMonths < 12);
  const pc = U.prepayCap(f, 'cap');
  assert.strictEqual(pc.cap, 0); assert.strictEqual(pc.raschet.base, 'nol');
});

test('(е) «только по факту» и «стоп» — ветка не срабатывает, прежний ответ', () => {
  const f = U.facts(otvet(OTCHET_NULL));
  assert.strictEqual(U.prepayCap(f, 'post').raschet.base, undefined);
  assert.strictEqual(U.prepayCap(f, 'post').rule, 'Оплата только по факту');
  assert.strictEqual(U.prepayCap(f, 'stop').rule, 'Вперёд не платить');
});

test('признак «отчёт сдан» — та же функция, что у строки «Выручка за … · В отчёте не указана»', () => {
  const r = otvet(OTCHET_NULL);
  assert.strictEqual(S.otchetGod(r), 2025);
  assert.strictEqual(U.facts(r).otchetGod, '2025');
  const usl = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  assert.ok(!/function godBezVyruchki/.test(usl), 'копии признака в usloviya.js быть не должно');
  // нулевая прибыль без баланса — не отчёт (как в sushchestvennoe): остаётся потолок по возрасту
  assert.ok(!U.facts(otvet({ charts: { revenue: [], profit: [{ year: 2025, value: 0 }] } })).vyruchkaNol);
});

test('страницы с «Условиями сделки» подключают sushchestvennoe.js раньше usloviya.js; правило — в формуле словами', () => {
  for (const p of ['index.html', 'report.html', 'indeks/index.html', 'pasport/kontragent/index.html']) {
    const h = fs.readFileSync(path.join(KOREN, p), 'utf8');
    const a = h.indexOf('/js/sushchestvennoe.js'), b = h.indexOf('/js/usloviya.js');
    assert.ok(a > 0 && b > a, p);
  }
  const fr = 'Если отчёт за&nbsp;год сдан, а&nbsp;выручки в&nbsp;нём нет, выручку считаем нулевой: предоплата — 0&nbsp;₽, советуем платить по&nbsp;факту. Потолок по&nbsp;возрасту — только для компаний, чьей отчётности в&nbsp;открытых данных нет.';
  for (const p of ['indeks/index.html', 'nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html']) {
    assert.ok(fs.readFileSync(path.join(KOREN, p), 'utf8').includes(fr), p);
  }
});
