// ne-svereno-v1 [Ночные запуски] 15.11: «Сервер» сам не берёт год, расходящийся с прошлыми в сотни раз, и сообщает о нём
// полем ne_svereno. Живой /api/check 15.11 23:10 (0105053225): ряды до 2024, dengi.vyruchka за 2024,
// ne_svereno [{god: 2025, pokazateli: ['vyruchka'], tekst: 'Год не сверен: …'}] — в корне и в dengi.vyruchka.
// Сайт должен сказать об этом году, а не молчать, будто отчётности нет. Компания вымышленная. node --test tests/ne_svereno.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('../js/istochniki.js');
const DIN = require('../js/dinamika.js');
const IO = require('../js/indeks-otvet.js');
IO.ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js'));
const bezNb = (t) => String(t).replace(/\u00a0/g, ' ');
const NS = [{ god: 2025, pokazateli: ['vyruchka', 'nalog'], tekst: 'Год не сверен: число из набора ФНС расходится с прошлым годом в сотни раз' }];

function otvet(over) {
  const r = {
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО "ПРИМЕР"', status: 'ACTIVE', okved: '86.23' },
    risk_level: 'low', risk_title: 'Низкий риск', checked_at: '2026-11-15T20:10:00Z',
    verdict: 'Работать можно. Есть один момент: задолженность по налогам. Уточните его перед крупной оплатой.',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '131 865 ₽ (недоимка, пени и штрафы)', source: 'ФНС, открытые данные', as_of: '01.10.2026' }
    ],
    dengi: { vyruchka: { summa: 21896000, god: 2024, istochnik: 'ГИР БО ФНС, годовая бухгалтерская отчётность (строка 2110)', data_nabora: null, ne_svereno: NS },
      sostavlyayushchie: [{ vid: 'nedoimka', summa: 131865, data_nabora: '2026-10-01' }], na_konu: 131865, dolya: 0.006, ne_uchteno: [], nepolno: false },
    ne_svereno: NS,
    dossier: {
      kpi: [{ label: 'Выручка за 2024', value: 21896000, delta: -31, good_up: true }, { label: 'Чистая прибыль за 2024', value: 812000, delta: -41, good_up: true }],
      charts: {
        revenue: [{ year: 2022, value: 16537000 }, { year: 2023, value: 31845000 }, { year: 2024, value: 21896000 }],
        profit: [{ year: 2022, value: 945000 }, { year: 2023, value: 1370000 }, { year: 2024, value: 812000 }],
        income_tax: [{ year: 2022, value: 169000 }, { year: 2023, value: 444000 }, { year: 2024, value: 683000 }],
        balance: { year: 2024, equity: 3672000, long_debt: 0, short_debt: 0 }
      },
      sections: [{ id: 'dynamics', title: 'Финансовая динамика по годам', comment: 'Бизнес растёт: выручка в среднем +28 % в год.',
        rows: [['2023', 'выручка 31,8 млн ₽, прибыль 1,4 млн ₽'], ['2024', 'выручка 21,9 млн ₽, прибыль 812 000 ₽'], ['Источник', 'ГИР БО ФНС, годовая бухгалтерская отчётность']] }]
    }
  };
  return Object.assign(r, over || {});
}
const kopiya = (o) => JSON.parse(JSON.stringify(o));

test('год, снятый сервером, — «Год не сверен» в «Динамике» и нейтральная строка светофора', () => {
  const r = I.dopolnit(otvet());
  const t = bezNb(r.sverka_dohodov_tekst);
  assert.match(t, /^Выручка и налог на прибыль за 2025 год в открытых данных ФНС расходятся с прошлыми годами в сотни раз/);
  assert.match(t, /Этот год не учитываем — ни в выручке, ни в налоговой нагрузке, ни в Индексе; выручка в отчёте — за 2024 год по бухотчётности\. Сверьте с бухотчётностью на bo\.nalog\.gov\.ru\.$/);
  const s = r.signals.filter((x) => x.id === 'sverka_dohodov');
  assert.strictEqual(s.length, 1);
  assert.strictEqual(s[0].status, 'not_checked');
  assert.strictEqual(bezNb(s[0].title), 'Доходы за 2025 год');
  assert.strictEqual(s[0].as_of, '31.12.2025');
  const html = bezNb(DIN.htmlDinamika(r));
  assert.match(html, /data-blok="sverka-dohodov"><b>Год не сверен\.<\/b> Выручка и налог на прибыль за 2025 год/);
  // итог, вывод и «Деньги на кону» сервера не трогаем — он уже посчитал их без этого года
  assert.strictEqual(r.risk_level, 'low');
  assert.strictEqual(r.verdict, otvet().verdict);
  assert.strictEqual(r.dengi.vyruchka.god, 2024);
});

test('повторный вызов ничего не добавляет (Паспорт и отчёт зовут dopolnit ещё раз)', () => {
  const r = I.dopolnit(otvet()); const a = kopiya(r);
  I.dopolnit(r);
  assert.deepStrictEqual(r, a);
});

test('поле только в dengi.vyruchka — тоже показываем; одна выручка — «расходится»', () => {
  const r = otvet(); delete r.ne_svereno;
  r.dengi.vyruchka.ne_svereno = [{ god: 2025, pokazateli: ['vyruchka'], tekst: '…' }];
  I.dopolnit(r);
  assert.match(bezNb(r.sverka_dohodov_tekst), /^Выручка за 2025 год в открытых данных ФНС расходится с прошлыми/);
});

test('сервер назвал год, но оставил его в рядах — снимаем из рядов и строк «Динамики»', () => {
  const r = otvet();
  r.dossier.charts.revenue.push({ year: 2025, value: 25186967000 });
  r.dossier.charts.income_tax.push({ year: 2025, value: 266147000 });
  r.dossier.sections[0].rows.splice(2, 0, ['2025', 'выручка 25,2 млрд ₽']);
  I.dopolnit(r);
  assert.ok(!r.dossier.charts.revenue.some((x) => x.year === 2025));
  assert.ok(!r.dossier.charts.income_tax.some((x) => x.year === 2025));
  assert.ok(!r.dossier.sections[0].rows.some((x) => x[0] === '2025'));
  assert.ok(!/млрд/.test(DIN.htmlDinamika(r)));
});

test('несколько лет — «Эти годы»; без показателей — «Доходы»', () => {
  const r = otvet({ ne_svereno: [{ god: 2025 }, { god: '2024' }] }); delete r.dengi.vyruchka.ne_svereno; r.dengi.vyruchka.god = 2023;
  I.dopolnit(r);
  const t = bezNb(r.sverka_dohodov_tekst);
  assert.match(t, /^Доходы за 2024 и 2025 годы в открытых данных ФНС расходятся/);
  assert.match(t, /Эти годы не учитываем/);
  assert.strictEqual(bezNb(r.signals.slice(-1)[0].title), 'Доходы за 2025 год');
});

test('без поля, с пустым или кривым полем — ничего не добавляем и не падаем', () => {
  for (const ns of [undefined, [], null, 'да', [null, {}, { god: 'х' }, { god: 1800 }]]) {
    const r = otvet(); r.ne_svereno = ns; delete r.dengi.vyruchka.ne_svereno;
    const a = kopiya(r); I.dopolnit(r);
    assert.ok(!r.sverka_dohodov_tekst && !r.sverka_servera, JSON.stringify(ns));
    assert.deepStrictEqual(r.signals, a.signals);
  }
});

test('Индекс тот же, что без поля: год уже снят сервером, строка «не проверяли» в факты не идёт', () => {
  const a = I.dopolnit(otvet());
  const b = otvet(); delete b.ne_svereno; delete b.dengi.vyruchka.ne_svereno; I.dopolnit(b);
  assert.deepStrictEqual(IO.izOtveta(a), IO.izOtveta(b));
});

test('своя сверка сайта (×100+ в рядах) главнее поля сервера — одна строка, текст с числами', () => {
  const r = otvet();
  r.dossier.charts.revenue.push({ year: 2025, value: 25186967000 });
  I.dopolnit(r);
  assert.ok(Array.isArray(r.sverka_dohodov) && !r.sverka_servera);
  assert.match(bezNb(r.sverka_dohodov_tekst), /^Доходы за 2025 год в открытых данных ФНС — 25 186 967 000 ₽/);
  assert.strictEqual(r.signals.filter((x) => x.id === 'sverka_dohodov').length, 1);
});
