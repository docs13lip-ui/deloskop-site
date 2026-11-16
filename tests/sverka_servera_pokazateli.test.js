// sverka-servera-pokazateli-v1 [команда] 16.11: сервер снял год полем ne_svereno, но в том же ответе прислал
// dengi.vyruchka и показатель «Выручка за <этот год>» (живой /api/check 16.11 22:08, образец главной 2309085638:
// ne_svereno 2025, dengi.vyruchka {god: 2025}). Показатели и «Деньги на кону» — за последний сверенный год.
// Компания вымышленная. node --test tests/sverka_servera_pokazateli.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('../js/istochniki.js');

function otvet(pokazateli) {
  const NS = [{ god: 2025, pokazateli: pokazateli || ['vyruchka'], tekst: 'Год не сверен: число из набора ФНС расходится с прошлым годом в сотни раз' }];
  return {
    company: { inn: '7700000002', kind: 'LEGAL', name_short: 'ПАО "ОБРАЗЕЦ"', status: 'ACTIVE' },
    risk_level: 'low', signals: [], ne_svereno: NS,
    dengi: { vyruchka: { summa: 412062000, god: 2025, istochnik: 'ГИР БО ФНС (строка 2110)', ne_svereno: NS }, na_konu: 35905, dolya: 0.0001, doli: { iski_otvetchik: 0.0001 } },
    dossier: {
      kpi: [{ label: 'Выручка за 2025', value: 412062000, delta: 0 }, { label: 'Чистая прибыль за 2025', value: 5354640000, delta: -92 },
        { label: 'Налоговая нагрузка', value: 0.4 }, { label: 'Активы', value: 597571091000, delta: 94 }],
      charts: {
        revenue: [{ year: 2023, value: 558670000 }, { year: 2024, value: 412062000 }, { year: 2025, value: 412062000 }],
        profit: [{ year: 2023, value: 98338389000 }, { year: 2024, value: 63777902000 }, { year: 2025, value: 5354640000 }]
      },
      sections: []
    }
  };
}
const kpi = (r, re) => r.dossier.kpi.filter((k) => re.test(k.label))[0];

test('выручка снятого года — показатель и «Деньги на кону» за последний сверенный год', () => {
  const r = I.dopolnit(otvet());
  const v = kpi(r, /^Выручка/);
  assert.strictEqual(v.label, 'Выручка за 2024');
  assert.strictEqual(v.value, 412062000);
  assert.strictEqual(v.delta, -26);
  assert.strictEqual(r.dengi.vyruchka.god, 2024);
  assert.strictEqual(r.dengi.vyruchka.zamena_za, 2025);
  assert.strictEqual(r.dengi.dolya, null);
  assert.strictEqual(kpi(r, /^Налоговая нагрузка/), undefined, 'нагрузка считалась от не сверенной выручки');
  assert.ok(!r.dossier.kpi.some((k) => / за 2025$/.test(k.label) && /^Выручка/.test(k.label)));
  assert.match(String(r.sverka_dohodov_tekst).replace(/ /g, ' '), /выручка в отчёте — за 2024 год по бухотчётности/);
});

test('прибыль сервер не снимал — «Чистая прибыль за 2025» остаётся как есть', () => {
  const r = I.dopolnit(otvet(['vyruchka']));
  const p = kpi(r, /^Чистая прибыль/);
  assert.strictEqual(p.label, 'Чистая прибыль за 2025');
  assert.strictEqual(p.value, 5354640000);
});

test('сняты и выручка, и прибыль — оба показателя за 2024; «Активы» не трогаем', () => {
  const r = I.dopolnit(otvet(['vyruchka', 'pribyl']));
  assert.strictEqual(kpi(r, /^Чистая прибыль/).label, 'Чистая прибыль за 2024');
  assert.strictEqual(kpi(r, /^Чистая прибыль/).value, 63777902000);
  assert.strictEqual(kpi(r, /^Активы/).value, 597571091000);
});

test('сверенных лет в ряду нет — показатель снят, сумма в «Деньгах на кону» пустая', () => {
  const o = otvet();
  o.dossier.charts.revenue = [{ year: 2025, value: 412062000 }];
  const r = I.dopolnit(o);
  assert.strictEqual(kpi(r, /^Выручка/), undefined);
  assert.strictEqual(r.dengi.vyruchka.summa, null);
  assert.strictEqual(r.dengi.vyruchka.zamena_za, 2025);
});

test('сервер уже прислал выручку за сверенный год — ничего не меняем', () => {
  const o = otvet();
  o.dengi.vyruchka.god = 2024;
  o.dossier.kpi[0] = { label: 'Выручка за 2024', value: 412062000, delta: -26 };
  const r = I.dopolnit(o);
  assert.strictEqual(r.dengi.vyruchka.god, 2024);
  assert.strictEqual(r.dengi.dolya, 0.0001);
  assert.strictEqual(kpi(r, /^Выручка/).label, 'Выручка за 2024');
});
