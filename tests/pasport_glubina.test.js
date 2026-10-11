// Паспорт контрагента v2.15 — «глубина из досье без повторов» (pasport-glubina-v1, Ночные-3 11.10).
// Повод — живой /api/report 11.10 (крупное ПАО): в разделе 6 четыре суммы стояли дважды (KPI и баланс), в разделе 7 —
// «Долг перед бюджетом — Нет» без даты и с подписью «ГИР БО» (Паспорт сам ловил это в proverit), убыток из KPI выходил «0 ₽»,
// а инспекция, филиалы, срок руководителя, уставный капитал, название ОКВЭД и число лицензий были в досье, но не в Паспорте.
// Ответ ниже — вымышленный, той же формы, что живой.
// node --test tests/pasport_glubina.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const NB = ' ';

function otvet(o) {
  o = o || {};
  const r = {
    checked_at: '2026-10-11T00:20:00+03:00',
    company: { inn: '7700000001', ogrn: '1027700000001', kpp: '770001001', kind: 'LEGAL', status: 'ACTIVE', name_short: 'АО «Пример»',
      name_full: 'АКЦИОНЕРНОЕ ОБЩЕСТВО «ПРИМЕР»', reg_date: '1999-03-01', okved: '46.71.4', okved_name: null,
      director_name: 'Иванов Иван Иванович', director_post: 'ГЕНЕРАЛЬНЫЙ ДИРЕКТОР' },
    risk_level: 'low',
    signals: [{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' }],
    dossier: {
      sections: [
        { id: 'profile', rows: [['Налоговая инспекция', 'Инспекция ФНС № 1 по г. Москве'], ['Филиалы и представительства', '3']] },
        { id: 'management', rows: [['Генеральный директор', 'Иванов Иван Иванович'], ['Руководит с', '12.04.2015 (11 лет 5 месяцев)'], ['Уставный капитал', '10 000 000 ₽']] },
        { id: 'activity', rows: [['Основной вид деятельности', '46.71.4 — Торговля оптовая природным (естественным) газом'], ['Дополнительных видов деятельности', '12'], ['Лицензии', '4']] },
        { id: 'taxes', rows: [['Задолженность всего', 'Нет'], ['Штрафы за налоговые правонарушения', 'Нет']] },
      ],
      kpi: [
        { label: 'Выручка за 2025', value: 5846351786000 },
        { label: 'Чистая прибыль за 2025', value: -1076329869000 },
        { label: 'Активы', value: 25736328136000 },
        { label: 'Собственный капитал', value: 16432222886000 },
        { label: 'Фирме должны', value: 1144646095000 },
        { label: 'Фирма должна поставщикам', value: 1172282674000 },
        { label: 'Кредиты и займы', value: 4425697799000 },
        { label: 'Долг перед бюджетом', value: null, text: 'Нет' },
      ],
      charts: {
        revenue: [2023, 2024, 2025].map((g, i) => ({ year: g, value: [5620061583000, 6256625972000, 5846351786000][i] })),
        balance: { year: 2025, equity: 16432222886000, long_debt: 6386347532000, short_debt: 2917757718000 },
        debts: { year: 2025, receivables: 1144646095000, payables: 1172282674000, loans: 4425697799000 },
      },
    },
  };
  if (o.bezBalansa) { delete r.dossier.charts.balance; delete r.dossier.charts.debts; }
  if (o.bezSekcij) delete r.dossier.sections;
  if (o.okvedName) r.company.okved_name = o.okvedName;
  if (o.okved) r.company.okved = o.okved;
  return r;
}
const opt = (o) => Object.assign({ usloviya: U, indeksVorota: IV }, o || {});
const rz = (p, id) => p.razdely.find((x) => x.id === id);
const fakt = (p, id, t) => rz(p, id).fakty.find((f) => f.tekst === t);
const teksty = (p, id) => rz(p, id).fakty.map((f) => f.tekst);

test('версия Паспорта — v2.15', () => {
  assert.strictEqual(P.VERSIYA, 'Паспорт v2.15');
});

test('раздел 6: суммы баланса не повторяются — KPI «капитал / должны / должна / кредиты» уступают строкам баланса', () => {
  const p = P.sobrat(otvet(), opt());
  const t = teksty(p, 'finansy');
  assert.strictEqual(new Set(t).size, t.length, 'повтор строки: ' + t.join(' | '));
  ['Фирме должны', 'Фирма должна поставщикам'].forEach((x) => assert.ok(!t.includes(x), x));
  assert.strictEqual(t.filter((x) => x === 'Собственный капитал').length, 1);
  assert.match(fakt(p, 'finansy', 'Собственный капитал').znachenie, /% баланса$/);
  assert.match(fakt(p, 'finansy', 'Кредиты и займы').znachenie, /% выручки за/);
});

test('раздел 6: без баланса в ответе KPI остаются — сумма не теряется', () => {
  const t = teksty(P.sobrat(otvet({ bezBalansa: true }), opt()), 'finansy');
  ['Собственный капитал', 'Фирме должны', 'Фирма должна поставщикам', 'Кредиты и займы'].forEach((x) => assert.ok(t.includes(x), x));
});

test('убыток из KPI — «минус …», а не «0 ₽»', () => {
  const f = fakt(P.sobrat(otvet(), opt()), 'finansy', 'Чистая прибыль за 2025');
  assert.strictEqual(f.znachenie, 'минус 1,08' + NB + 'трлн' + NB + '₽ (' + U.money(1076329869000) + ')');
  assert.doesNotMatch(f.znachenie, /^0 ₽/);
});

test('крупные суммы: от 1 млрд ₽ — словами и точно в скобках; меньше — как было; ряд выручки — только словами', () => {
  assert.strictEqual(P.krupno(999999999, 'x'), 'x');
  assert.strictEqual(P.krupno(1e9, 'x'), '1' + NB + 'млрд' + NB + '₽ (x)');
  assert.strictEqual(P.krupno(16432222886000, 'x'), '16,4' + NB + 'трлн' + NB + '₽ (x)');
  const rv = fakt(P.sobrat(otvet(), opt()), 'finansy', 'Выручка по годам').znachenie;
  assert.strictEqual(rv, '2023 — 5,62' + NB + 'трлн' + NB + '₽ · 2024 — 6,26' + NB + 'трлн' + NB + '₽ · 2025 — 5,85' + NB + 'трлн' + NB + '₽');
});

test('раздел 7: «Долг перед бюджетом — Нет» без даты не выводим; долг по налогам — одной строкой из набора ФНС с датой', () => {
  const p = P.sobrat(otvet(), opt());
  assert.deepStrictEqual(teksty(p, 'nalogi'), ['Задолженность по налогам']);
  assert.strictEqual(fakt(p, 'nalogi', 'Задолженность по налогам').data, '2026-09-01');
  assert.deepStrictEqual(P.proverit(p), []);
});

test('раздел 1: инспекция и филиалы из ЕГРЮЛ; 0 филиалов — строки нет', () => {
  const p = P.sobrat(otvet(), opt());
  assert.strictEqual(fakt(p, 'rekvizity', 'Налоговая инспекция').znachenie, 'Инспекция ФНС № 1 по г. Москве');
  assert.strictEqual(fakt(p, 'rekvizity', 'Филиалы и представительства').znachenie, '3');
  assert.strictEqual(fakt(p, 'rekvizity', 'Налоговая инспекция').istochnik, 'ЕГРЮЛ');
  const r0 = otvet(); r0.dossier.sections[0].rows[1][1] = '0';
  assert.ok(!teksty(P.sobrat(r0, opt()), 'rekvizity').includes('Филиалы и представительства'));
});

test('раздел 3: «Руководит с» и уставный капитал; без флага persons — ни одного ФИО', () => {
  const p = P.sobrat(otvet(), opt());
  assert.strictEqual(fakt(p, 'lyudi', 'Руководит с').znachenie, '12.04.2015 (11 лет 5 месяцев)');
  assert.strictEqual(fakt(p, 'lyudi', 'Уставный капитал').znachenie, '10 000 000 ₽');
  const bez = P.sobrat(otvet(), opt({ persons: false }));
  assert.doesNotMatch(JSON.stringify(bez.razdely), /Иванов/);
  assert.ok(teksty(bez, 'lyudi').includes('Руководит с'));
});

test('раздел 5: ОКВЭД с названием из досье, доп. виды и лицензии; чужое название не берём', () => {
  const p = P.sobrat(otvet(), opt());
  assert.strictEqual(fakt(p, 'deyatelnost', 'Основной вид деятельности').znachenie, '46.71.4 — Торговля оптовая природным (естественным) газом');
  assert.strictEqual(fakt(p, 'deyatelnost', 'Дополнительных видов деятельности').znachenie, '12');
  assert.strictEqual(fakt(p, 'deyatelnost', 'Лицензии').znachenie, '4 — перечень в' + NB + 'выписке ЕГРЮЛ');
  assert.strictEqual(fakt(P.sobrat(otvet({ okved: '47.11' }), opt()), 'deyatelnost', 'Основной вид деятельности').znachenie, '47.11');
  assert.strictEqual(fakt(P.sobrat(otvet({ okvedName: 'Своё' }), opt()), 'deyatelnost', 'Основной вид деятельности').znachenie, '46.71.4 — Своё');
});

test('без разделов досье — Паспорт как раньше (новых строк нет, ошибок нет)', () => {
  const p = P.sobrat(otvet({ bezSekcij: true }), opt());
  ['Налоговая инспекция', 'Филиалы и представительства'].forEach((x) => assert.ok(!teksty(p, 'rekvizity').includes(x)));
  assert.ok(!teksty(p, 'lyudi').includes('Руководит с'));
  assert.strictEqual(fakt(p, 'deyatelnost', 'Основной вид деятельности').znachenie, '46.71.4');
  assert.deepStrictEqual(P.proverit(p), []);
});
