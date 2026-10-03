// «На чём держится компания» и «Кто кому должен» в «Динамике» экрана проверки — js/dinamika.js, balans-ekran-v1.
// Только факты баланса ГИР БО (dossier.charts.balance / debts), без оценок; в PDF-досье (report.html) не дублируем.
// node --test tests/balans_ekran.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = require('../js/dinamika.js');
const NB = ' ';

// Форма живого ответа /api/check 03.10 (ПАО «Газпром», ИНН 7736050003), суммы — как в ответе
function otvet(o) {
  o = o || {};
  const charts = {
    revenue: [2021, 2022, 2023, 2024, 2025].map((g, i) => ({ year: g, value: [6388987167000, 7979026948000, 5620061583000, 6256625972000, 5846351786000][i] })),
    profit: [2021, 2022, 2023, 2024, 2025].map((g, i) => ({ year: g, value: [2684456626000, 747246272000, 695570288000, -1076329869000, 11284564000][i] })),
    balance: { year: 2025, equity: 16432222886000, long_debt: 6386347532000, short_debt: 2917757718000 },
    debts: { year: 2025, receivables: 1144646095000, payables: 1172282674000, loans: 4425697799000 },
  };
  Object.keys(o).forEach((k) => { if (o[k] === null) delete charts[k]; else charts[k] = o[k]; });
  return { company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE' }, risk_level: 'low', signals: [], dossier: { charts } };
}
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('структура баланса: доли по капиталу и обязательствам, сумма 100 %', () => {
  const b = D.balans(otvet());
  assert.strictEqual(b.god, 2025);
  assert.deepStrictEqual(b.chasti.map((x) => [x.k, x.dolya]), [['kap', '64' + NB + '%'], ['dol', '25' + NB + '%'], ['kor', '11' + NB + '%']]);
  assert.ok(Math.abs(b.chasti.reduce((a, x) => a + x.w, 0) - 100) < 1e-9);
  assert.strictEqual(b.kapitalMinus, null);
});

test('кто кому должен: три строки; кредиты к выручке того же года', () => {
  const b = D.balans(otvet());
  assert.deepStrictEqual(b.raschety.map((x) => x.k), ['rec', 'pay', 'loan']);
  assert.strictEqual(b.zajmyKVyr, 76);
  const h = tekst(D.htmlBalans(otvet()));
  assert.match(h, /На чём держится компания баланс на 31\.12\.2025/);
  assert.match(h, /Кредиты и займы 4,4 трлн ₽ 76 % выручки за 2025/);
  // выручки за год долга нет — процента нет
  const b2 = D.balans(otvet({ debts: { year: 2026, loans: 5e12 } }));
  assert.strictEqual(b2.zajmyKVyr, null);
  assert.strictEqual(b2.godR, 2026);
});

test('отрицательный капитал: в полосе только обязательства, капитал — красной строкой без доли', () => {
  const r = otvet({ balance: { year: 2025, equity: -3e8, long_debt: 1e8, short_debt: 4e8 } });
  const b = D.balans(r);
  assert.deepStrictEqual(b.chasti.map((x) => x.k), ['dol', 'kor']);
  assert.strictEqual(b.kapitalMinus, -3e8);
  const h = D.htmlBalans(r);
  assert.match(h, /din__minus/);
  assert.match(tekst(h), /Собственный капитал −300,0 млн ₽ меньше нуля/);
});

test('нет баланса и долгов, мусор — блока нет; нулевые строки не показываем', () => {
  assert.strictEqual(D.balans(otvet({ balance: null, debts: null })), null);
  assert.strictEqual(D.htmlBalans({}), '');
  assert.strictEqual(D.balans(otvet({ balance: { year: 'x', equity: 1 }, debts: { year: 2025, receivables: 0, payables: null, loans: 'abc' } })), null);
  const b = D.balans(otvet({ debts: { year: 2025, receivables: 0, payables: 5e6, loans: 0 } }));
  assert.deepStrictEqual(b.raschety.map((x) => x.k), ['pay']);
});

test('в «Динамике» экрана — есть; в PDF-досье ({balans:false}) — нет; без рядов — отдельной секцией', () => {
  const r = otvet();
  assert.match(D.htmlDinamika(r), /data-blok="balans"/);
  assert.doesNotMatch(D.htmlDinamika(r, { balans: false }), /data-blok="balans"/);
  const ls = { getItem: () => null, setItem: () => {} };
  assert.match(D.html(r, { ls }), /data-blok="balans"/);
  assert.doesNotMatch(D.html(r, { ls, balans: false }), /data-blok="balans"/);
  const bezRyadov = otvet({ revenue: null, profit: null });
  const h = D.html(bezRyadov, { ls });
  assert.match(h, /<section class="din" aria-label="Баланс по годовой отчётности">/);
  assert.match(h, /Источник: ГИР БО ФНС/);
  assert.strictEqual(D.html(bezRyadov, { ls, balans: false }), '');
});

test('тексты: только факты — без оценок, обещаний и превосходных степеней; report.html отключает блок', () => {
  const h = tekst(D.htmlBalans(otvet()) + D.htmlBalans(otvet({ balance: { year: 2025, equity: -1, long_debt: 1, short_debt: 1 } })));
  for (const z of [/надёжн/i, /опасн/i, /устойчив/i, /зависит/i, /гарант/i, /лучш/i, /рекоменд/i, /плохо|хорошо/i]) assert.doesNotMatch(h, z);
  const rep = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.match(rep, /Dinamika\.html\(R,\{balans:false\}\)/);
});
