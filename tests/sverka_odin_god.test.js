// sverka-odin-god-v1 [Ночные запуски] 16.11: у компании один год в наборе ФНС «доходы и расходы» — сверить с прошлыми не с чем.
// Живой /api/check 16.11 00:10: 9726049490 — доходы 2025 17 661 737 000 ₽ при активах 16 000 ₽; 7203559982 (УСН) —
// 63 220 602 000 ₽ при активах 4,9 млн ₽. Сайт сверяет с активами того же года и с лимитом УСН (п. 4 ст. 346.13 НК),
// сумму убирает из показателей и «Денег на кону», итог и статусы строк не трогает. Компании вымышленные.
// node --test tests/sverka_odin_god.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('../js/istochniki.js');
const bezNb = (t) => String(t).replace(/ /g, ' ');

function otvet(o) {
  o = o || {};
  const god = o.god || 2025, dohod = o.dohod != null ? o.dohod : 17661737000, aktivy = o.aktivy != null ? o.aktivy : 16000;
  const r = {
    company: { inn: '7700000002', ogrn: '1237700000002', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE', okved: '47.41' },
    risk_level: 'high', risk_title: 'Высокий риск',
    verdict: 'Работать не рекомендуем: задолженность по налогам, сотрудники, низкая налоговая нагрузка. Платёж такой компании может вызвать вопросы банка по 115-ФЗ, а сделка — у налоговой.',
    signals: [
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '206 868 ₽ (недоимка, пени и штрафы)' },
      { id: 'staff', title: 'Сотрудники', status: 'warn', detail: 'Среднесписочная численность: 0' },
      { id: 'tax_burden', title: 'Низкая налоговая нагрузка', status: 'warn', detail: 'Доходы ' + String(dohod).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽, уплачено налогов 0 ₽' }
    ],
    dengi: { vyruchka: { summa: dohod, god: god, istochnik: 'ФНС, открытые данные: доходы и расходы организации', data_nabora: god + '-12-31' },
      sostavlyayushchie: [{ vid: 'nedoimka', summa: 206867 }], na_konu: 206867, dolya: 0.00001 },
    dossier: {
      kpi: [{ label: 'Выручка за ' + god, value: dohod, delta: null }, { label: 'Чистая прибыль за ' + god, value: dohod, delta: null },
        { label: 'Активы', value: aktivy, delta: null }, { label: 'Налоговая нагрузка без взносов', value: null, text: '0,0 %' }, { label: 'Сотрудники', value: null, text: '0 чел.' }],
      charts: { revenue: (o.ryad || []).concat([{ year: god, value: dohod }]), profit: [{ year: god, value: dohod }],
        balance: o.bezBalansa ? undefined : { year: god, equity: aktivy, long_debt: 0, short_debt: 0 } },
      sections: [
        { id: 'activity', rows: [['Основной вид деятельности', '47.41 — Торговля'], ...(o.usn ? [['Налоговый режим', 'УСН']] : [])] },
        { id: 'finance', rows: [['Доходы за год', '17,7 млрд ₽'], ['Расходы за год', '0 ₽'], ['Рентабельность', '100,0 %'], ['Уплачено налогов и взносов', '0 ₽'], ['Данные на', '31.12.' + god]] },
        { id: 'dynamics', rows: [[String(god), 'выручка 17,7 млрд ₽, прибыль 17,7 млрд ₽'], ['Доля заёмных средств', '0,0 %']] }
      ]
    }
  };
  if (o.bezBalansa) delete r.dossier.charts.balance;
  return r;
}

test('один год, доходы в 10 000+ раз больше активов — сумма уходит из отчёта, итог и статусы прежние', () => {
  const ish = otvet(), r = I.dopolnit(otvet());
  assert.deepStrictEqual(r.sverka_odin_god, { god: 2025, summa: 17661737000, aktivy: 16000, usn: false });
  assert.strictEqual(r.risk_level, 'high');
  assert.strictEqual(r.verdict, ish.verdict);
  assert.deepStrictEqual(r.signals.map((s) => s.status), ['warn', 'warn', 'warn']);
  const nag = r.signals[2];
  assert.strictEqual(bezNb(nag.detail), 'Уплачено налогов 0 ₽; доходы за 2025 год в наборе ФНС не сверены — сумму не показываем');
  assert.ok(!/17 661/.test(bezNb(nag.detail)));
  assert.deepStrictEqual(r.dossier.kpi.map((k) => k.label), ['Активы', 'Сотрудники']);
  assert.deepStrictEqual(r.dossier.charts.revenue, []);
  assert.strictEqual(r.dengi.vyruchka.summa, null);
  assert.strictEqual(r.dengi.vyruchka.zamena_za, 2025);
  assert.strictEqual(r.dengi.dolya, null);
  const fin = r.dossier.sections.find((s) => s.id === 'finance');
  assert.deepStrictEqual(fin.rows.map((x) => x[0]), ['Уплачено налогов и взносов', 'Данные на']);
  const t = bezNb(r.sverka_dohodov_tekst);
  assert.match(t, /^Доходы за 2025 год в открытых данных ФНС — 17 661 737 000 ₽, в 1 103 859 раз больше активов на 31\.12\.2025 \(16 000 ₽\)\. /);
  assert.match(t, /итог проверки — как у сервера\. Сверьте с бухотчётностью на bo\.nalog\.gov\.ru\.$/);
  assert.strictEqual(fin.comment, r.sverka_dohodov_tekst);
  assert.ok(!r.dossier.sections.find((s) => s.id === 'dynamics').rows.some((x) => x[0] === '2025'));
});

test('УСН без баланса: доходы от 1 млрд ₽ — больше двух лимитов упрощёнки', () => {
  const r = I.dopolnit(otvet({ dohod: 1200000000, bezBalansa: true, usn: true }));
  assert.ok(r.sverka_odin_god && r.sverka_odin_god.usn === true && r.sverka_odin_god.aktivy === null);
  assert.match(bezNb(r.sverka_dohodov_tekst), /— 1 200 000 000 ₽, а компания на УСН, где лимит доходов — 450 млн ₽ в год\./);
});

test('настоящий крупный оборот не трогаем: активы соразмерны, не УСН', () => {
  const r = I.dopolnit(otvet({ dohod: 2000000000, aktivy: 300000000 }));
  assert.strictEqual(r.sverka_odin_god, undefined);
  assert.strictEqual(r.dengi.vyruchka.summa, 2000000000);
  assert.ok(/2 000 000 000/.test(r.signals[2].detail));
});

test('порог: меньше 1 млрд ₽ — не сверяем; ровно ×10 000 к активам — сверяем', () => {
  assert.strictEqual(I.dopolnit(otvet({ dohod: 999000000, aktivy: 1000 })).sverka_odin_god, undefined);
  assert.ok(I.dopolnit(otvet({ dohod: 1000000000, aktivy: 100000 })).sverka_odin_god);
  assert.strictEqual(I.dopolnit(otvet({ dohod: 1000000000, aktivy: 100001 })).sverka_odin_god, undefined);
});

test('есть прошлые годы — работает прежняя сверка, эта молчит', () => {
  const r = I.dopolnit(otvet({ ryad: [{ year: 2024, value: 17661737 }] }));
  assert.strictEqual(r.sverka_odin_god, undefined);
  assert.ok(Array.isArray(r.sverka_dohodov));
});

test('баланс за другой год — по активам не сверяем', () => {
  const o = otvet(); o.dossier.charts.balance.year = 2024;
  assert.strictEqual(I.dopolnit(o).sverka_odin_god, undefined);
});

test('на экране проверки: таблицы «Динамики» нет — строка «Год не сверен» всё равно есть', () => {
  const DIN = require('../js/dinamika.js');
  const r = I.dopolnit(otvet({ usn: true }));
  assert.strictEqual(DIN.htmlDinamika(r), '');
  const h = bezNb(DIN.html(r, { ls: null }));
  assert.match(h, /data-blok="sverka-dohodov"><b>Год не сверен\.<\/b> Доходы за 2025 год в открытых данных ФНС/);
  assert.ok(!/data-blok="sverka-dohodov"/.test(DIN.html(I.dopolnit(otvet({ dohod: 2000000000, aktivy: 300000000 })), { ls: null })));
});

test('«Условия сделки»: не сверенные доходы — не «отчёт без выручки», предел по возрасту', () => {
  const SU = require('../js/sushchestvennoe.js');
  const r = I.dopolnit(otvet({ usn: true }));
  assert.strictEqual(SU.otchetGod(r), null);
  const U = require('../js/usloviya.js');
  const f = U.facts(r);
  assert.ok(!f.vyruchkaNol && !f.revenue);
  const cap = U.prepayCap(f, 'cap');
  assert.ok(['age', 'insufficient_data'].includes(cap.raschet.base)); // не 'nol': «отчёт сдан, выручки нет» было бы неправдой
  const fakty = SU.fakty(r).spisok;
  assert.ok(fakty.some((x) => /^Выручка за 2025$/.test(x.nazv) && /^Не сверена/.test(bezNb(x.znach))));
});
