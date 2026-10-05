// otchet-bez-vyruchki-v1 [Ночные-3] 05.10: отчёт в ГИР БО сдан, выручки в нём нет.
// Живой ответ /api/check (ООО, 2009 г.): charts.revenue = [], «Выручка за 2025» = null, прибыль и баланс за 2025 есть.
// Было: «Бухотчётность · Нет в ответе ГИР БО» рядом с «Собственным капиталом на 31.12.2025» из того же ГИР БО;
// в «Условиях сделки» — «сотрудники: среднесписочная численность: 0, в штате никого».
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');
const U = require('../js/usloviya.js');
const NB = ' ';

function otvet(dossier, signals) {
  return { checked_at: '2026-10-05', risk_level: 'medium',
    company: { inn: '7800000001', ogrn: '1097800000001', kind: 'LEGAL', name_short: 'ООО «Тест»', status: 'ACTIVE',
      reg_date: '2009-11-25', director_since: '2023-10-09', okved: '43.11' },
    signals: signals || [], dossier: dossier };
}
const ZHIVOJ = {
  kpi: [{ label: 'Выручка за 2025', value: null }, { label: 'Чистая прибыль за 2025', value: -2100000 }],
  charts: { revenue: [], profit: [{ year: 2022, value: 0 }, { year: 2023, value: -2391000 }, { year: 2024, value: -245000 }, { year: 2025, value: -2100000 }],
    balance: { year: 2025, equity: -11058000 } },
};

test('отчёт сдан без выручки — «Выручка за 2025 · В отчёте не указана · убыток», не «Нет в ответе ГИР БО»', () => {
  const f = S.fakty(otvet(ZHIVOJ));
  const vse = f.spisok.concat(f.eshche);
  const o = vse.find((x) => x.k === 'otchetnost');
  assert.strictEqual(o.nazv, 'Выручка за 2025');
  assert.strictEqual(o.znach, 'В' + NB + 'отчёте не' + NB + 'указана · убыток 2,1' + NB + 'млн' + NB + '₽');
  assert.strictEqual(o.data, '31.12.2025');
  assert.ok(!o.spravka, 'ссылка «почему так бывает» — только когда отчёта нет');
  assert.ok(!vse.some((x) => /Нет в ответе ГИР БО/.test(x.znach)));
});

test('год — по балансу; без баланса — по ненулевой прибыли; нулевая прибыль отчётом не считается', () => {
  const tolkoPr = { charts: { revenue: [], profit: [{ year: 2024, value: 500000 }, { year: 2025, value: 0 }] } };
  const o = S.fakty(otvet(tolkoPr)).spisok.concat(S.fakty(otvet(tolkoPr)).eshche).find((x) => x.k === 'otchetnost');
  assert.strictEqual(o.nazv, 'Выручка за 2024');
  assert.match(o.znach, /прибыль 500/);
  const nuli = { charts: { revenue: [], profit: [{ year: 2025, value: 0 }] } };
  const f = S.fakty(otvet(nuli));
  assert.strictEqual(f.spisok.concat(f.eshche).find((x) => x.k === 'otchetnost').znach, 'Нет в ответе ГИР БО');
});

test('выручка есть — строка прежняя', () => {
  const d = { charts: { revenue: [{ year: 2025, value: 12000000 }], profit: [{ year: 2025, value: 300000 }] } };
  const f = S.fakty(otvet(d));
  const o = f.spisok.concat(f.eshche).find((x) => x.k === 'otchetnost');
  assert.strictEqual(o.nazv, 'Выручка за 2025');
  assert.match(o.znach, /^12/);
});

test('банк без отчётности в ГИР БО — по-прежнему своя строка', () => {
  const r = otvet({ charts: {} }); r.company.okved = '64.19';
  const o = S.fakty(r).spisok.find((x) => x.k === 'otchetnost');
  assert.match(o.znach, /Банк России/);
});

test('«Условия сделки»: штат не повторяется дважды', () => {
  const r = otvet(ZHIVOJ, [
    { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '1 937 ₽ (недоимка, пени и штрафы)' },
    { id: 'employees', title: 'Сотрудники', status: 'warn', detail: 'Среднесписочная численность: 0' },
  ]);
  const v = U.decide(r);
  const t = v.reasons.join(', ');
  assert.match(t, /сотрудники: среднесписочная численность: 0/);
  assert.ok(!/в штате никого/.test(t), t);
});

test('«Условия сделки»: без признака штата — о штате не больше одной причины', () => {
  const r = otvet(ZHIVOJ, [{ id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '1 937 ₽' }]);
  r.dossier = Object.assign({}, ZHIVOJ);
  const v = U.decide(r);
  // штат берётся только из признака; без признака причина о штате не появляется вовсе
  assert.ok(v.reasons.filter((x) => /штат/.test(x)).length <= 1);
});
