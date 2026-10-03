// Паспорт контрагента, раздел 6 «Финансы и штат»: баланс и расчёты на 31.12 (pasport-balans-v1, Ночные-3 03.10).
// Тот же источник, что «На чём держится компания» / «Кто кому должен» на экране проверки: dossier.charts.balance / debts (ГИР БО).
// node --test tests/pasport_balans.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const NB = '\u00a0';
const M = (n) => U.money(n); // разряды — тем же пробелом, что у U.money

// Суммы — форма живого ответа /api/check 03.10 (ПАО «Газпром», ИНН 7736050003)
function otvet(o) {
  o = o || {};
  const charts = {
    revenue: [2023, 2024, 2025].map((g, i) => ({ year: g, value: [5620061583000, 6256625972000, 5846351786000][i] })),
    balance: { year: 2025, equity: 16432222886000, long_debt: 6386347532000, short_debt: 2917757718000 },
    debts: { year: 2025, receivables: 1144646095000, payables: 1172282674000, loans: 4425697799000 },
  };
  Object.keys(o).forEach((k) => { if (o[k] === null) delete charts[k]; else charts[k] = o[k]; });
  return { checked_at: '2026-10-03T11:00:00+03:00', company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ПАО «Газпром»' },
    risk_level: 'low', signals: [], dossier: { charts } };
}
const opt = (o) => Object.assign({ usloviya: U, indeksVorota: IV }, o || {});
const r6 = (p) => p.razdely.find((x) => x.id === 'finansy');
const fakt = (p, t) => r6(p).fakty.find((f) => f.tekst === t);

test('баланс: три части пассива с долями от баланса, дата 31.12 и источник ГИР БО', () => {
  const p = P.sobrat(otvet(), opt());
  const kap = fakt(p, 'Собственный капитал');
  assert.strictEqual(kap.znachenie, M(16432222886000) + ' — 64' + NB + '% баланса');
  assert.strictEqual(fakt(p, 'Долгосрочные обязательства').znachenie, M(6386347532000) + ' — 25' + NB + '% баланса');
  assert.strictEqual(fakt(p, 'Краткосрочные обязательства').znachenie, M(2917757718000) + ' — 11' + NB + '% баланса');
  assert.strictEqual(kap.data, '2025-12-31');
  assert.strictEqual(kap.istochnik, 'ГИР БО, бухгалтерский баланс');
  assert.strictEqual(kap.ton, 'info');
  assert.strictEqual(r6(p).data_svedeniy, '2025-12-31');
  assert.deepStrictEqual(P.proverit(p), []);
});

test('расчёты: дебиторка, кредиторка, кредиты — процент выручки только у кредитов и только за тот же год', () => {
  const p = P.sobrat(otvet(), opt());
  assert.strictEqual(fakt(p, 'Дебиторская задолженность (должны компании)').znachenie, M(1144646095000) + '');
  assert.strictEqual(fakt(p, 'Кредиторская задолженность (должна компания)').znachenie, M(1172282674000) + '');
  assert.strictEqual(fakt(p, 'Кредиты и займы').znachenie, M(4425697799000) + ' — 76' + NB + '% выручки за' + NB + '2025');
  const p2 = P.sobrat(otvet({ debts: { year: 2026, loans: 5e9 } }), opt());
  assert.strictEqual(fakt(p2, 'Кредиты и займы').znachenie, M(5000000000) + '');
  assert.strictEqual(fakt(p2, 'Кредиты и займы').data, '2026-12-31');
});

test('капитал меньше нуля: «минус …», без долей, тон warn — раздел не пишет «настораживающих отметок нет»', () => {
  const p = P.sobrat(otvet({ balance: { year: 2025, equity: -12400000, long_debt: 1e8, short_debt: 4e8 } }), opt());
  const kap = fakt(p, 'Собственный капитал');
  assert.strictEqual(kap.znachenie, 'минус ' + M(12400000) + ' — меньше нуля');
  assert.strictEqual(kap.ton, 'warn');
  assert.strictEqual(fakt(p, 'Краткосрочные обязательства').znachenie, M(400000000) + '');
  assert.doesNotMatch(r6(p).vyvod, /настораживающих отметок нет/);
  assert.deepStrictEqual(P.proverit(p), []);
});

test('неполный баланс — суммы без долей; мусор и пустые ряды — строк нет', () => {
  const p = P.sobrat(otvet({ balance: { year: 2025, equity: 5e8, long_debt: null, short_debt: 2e8 } }), opt());
  assert.strictEqual(fakt(p, 'Собственный капитал').znachenie, M(500000000) + '');
  assert.strictEqual(fakt(p, 'Долгосрочные обязательства'), undefined);
  const p2 = P.sobrat(otvet({ balance: { year: 'x', equity: 1 }, debts: { year: 2025, receivables: 'abc', payables: null } }), opt());
  ['Собственный капитал', 'Кредиты и займы', 'Дебиторская задолженность (должны компании)'].forEach((t) => assert.strictEqual(fakt(p2, t), undefined, t));
  const p3 = P.sobrat(otvet({ balance: null, debts: null, revenue: null }), opt());
  assert.strictEqual(r6(p3).status, 'not_checked');
});

test('бесплатный уровень: раздел 6 закрыт — сумм баланса нет ни на экране, ни в отпечатке', () => {
  const p = P.sobrat(otvet(), opt({ dostup: 'free' }));
  assert.strictEqual(r6(p).status, 'locked');
  assert.strictEqual(r6(p).fakty.length, 0);
  assert.doesNotMatch(JSON.stringify(p), new RegExp(M(16432222886000).slice(0, 6)));
});

test('без оценок: в строках баланса нет слов из словаря 222-ФЗ и оценочных слов', () => {
  const p = P.sobrat(otvet({ balance: { year: 2025, equity: -1e6, long_debt: 0, short_debt: 3e6 } }), opt());
  r6(p).fakty.forEach((f) => {
    const t = f.tekst + ' ' + f.znachenie;
    assert.doesNotMatch(t, P.SLOVAR_222, t);
    assert.doesNotMatch(t, /надёжн|устойчив|зависим|гарант|опасн|плох|хорош/i, t);
  });
});

test('три доли баланса в сумме дают ровно 100 % (наибольший остаток)', () => {
  const p = P.sobrat(otvet({ balance: { year: 2025, equity: 18600000, long_debt: 4000000, short_debt: 12900000 } }), opt());
  const d = ['Собственный капитал', 'Долгосрочные обязательства', 'Краткосрочные обязательства']
    .map((t) => +/— (\d+)\u00a0% баланса/.exec(fakt(p, t).znachenie)[1]);
  assert.deepStrictEqual(d, [53, 11, 36]);
  assert.strictEqual(d.reduce((a, x) => a + x, 0), 100);
});
