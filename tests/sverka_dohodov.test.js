// sverka-dohodov-v1 [Ночные запуски] 14.11: доходы года из набора ФНС «доходы и расходы», которые в 100+ раз больше
// последнего года с выручкой (и от 1 млрд ₽), не учитываем ни в рядах, ни в показателях, ни в «Деньгах на кону», ни в Индексе.
// Живой /api/check 14.11 10:10 (0105053225): 2024 — 31 438 000 ₽, 2025 — 32 461 319 000 ₽, строка «Низкая налоговая нагрузка» warn.
// Форма ответа — как живая; компания вымышленная. node --test tests/sverka_dohodov.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../js/istochniki.js');
const IM = require('../js/imya.js');
const DNK = require('../js/dengi-na-konu.js');
const IO = require('../js/indeks-otvet.js');
IO.ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js'));
const NB = ' ';
const bezNb = (t) => String(t).replace(/ /g, ' ');

function otvet(over) {
  const r = {
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО "ПРИМЕР"', status: 'ACTIVE', okved: '86.23' },
    risk_level: 'medium', checked_at: '2026-11-14T07:10:00Z',
    verdict: 'Работать можно с осторожностью: обратите внимание — задолженность по налогам, низкая налоговая нагрузка. Перед крупной оплатой запросите документы и сохраните их в деле.',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '2 100 000 ₽ (недоимка, пени и штрафы)', source: 'ФНС, открытые данные', as_of: '01.10.2026' },
      { id: 'tax_burden', title: 'Низкая налоговая нагрузка', status: 'warn', detail: 'Доходы 32 461 319 000 ₽, уплачено налогов 2 619 794 ₽', source: 'ФНС, открытые данные', as_of: '31.12.2025' }
    ],
    dengi: { vyruchka: { summa: 32461319000, god: 2025, istochnik: 'ФНС, открытые данные: доходы и расходы организации', data_nabora: '2025-12-31' },
      sostavlyayushchie: [
        { vid: 'iski_otvetchik', summa: 0, chislo: 0, ohvat: 'vse', data_svedeniy: '2026-11-13T09:17+03:00' },
        { vid: 'fssp_ostatok', summa: 0, chislo: 0, ohvat: 'vse', data_svedeniy: '2026-11-13T09:17+03:00' },
        { vid: 'nedoimka', summa: 2100000, data_nabora: '2026-10-01' }],
      na_konu: 2100000, dolya: 0.0001, doli: { nedoimka: 0.0001 }, ne_uchteno: [], nepolno: false },
    dossier: {
      kpi: [
        { label: 'Выручка за 2025', value: 32461319000, delta: 103155, good_up: true },
        { label: 'Чистая прибыль за 2025', value: 12237319000, delta: 130251, good_up: true },
        { label: 'Активы', value: 12957000, delta: 1, good_up: true },
        { label: 'Налоговая нагрузка без взносов', value: null, text: '0,0 %', delta: null, good_up: true },
        { label: 'Сотрудники', value: null, text: '10 чел.', delta: null, good_up: true }],
      charts: {
        revenue: [{ year: 2022, value: 916000 }, { year: 2023, value: 21543000 }, { year: 2024, value: 31438000 }, { year: 2025, value: 32461319000 }],
        profit: [{ year: 2022, value: 649000 }, { year: 2023, value: 3948000 }, { year: 2024, value: 9388000 }, { year: 2025, value: 12237319000 }],
        balance: { year: 2025, equity: 12947000, long_debt: 0, short_debt: 10000 }
      },
      sections: [
        { id: 'finance', title: 'Финансы по данным ФНС', comment: 'Оборот около 32,5 млрд ₽ в год, компания прибыльна. Налогов уплачено меньше 1 % от доходов.',
          rows: [['Доходы за год', '32,5 млрд ₽'], ['Расходы за год', '20,2 млрд ₽'], ['Финансовый результат', '+12,2 млрд ₽'], ['Рентабельность', '37,7 %'],
            ['Уплачено налогов и взносов', '2,6 млн ₽'], ['Налоговая нагрузка без взносов', '0,0 %'], ['Доход на одного сотрудника', '3,2 млрд ₽'], ['Данные на', '31.12.2025']] },
        { id: 'dynamics', title: 'Финансовая динамика по годам', comment: 'Бизнес растёт: выручка в среднем +733 % в год. Чистая рентабельность 37,7 % — компания зарабатывает. Оборотных средств хватает, чтобы покрыть текущие долги.',
          rows: [['2023', 'выручка 21,5 млн ₽, прибыль 3,9 млн ₽'], ['2024', 'выручка 31,4 млн ₽, прибыль 9,4 млн ₽'], ['2025', 'выручка 32,5 млрд ₽, прибыль 12,2 млрд ₽'],
            ['Средний рост выручки в год', '732,8 %'], ['Текущая ликвидность', '241,70'], ['Источник', 'ГИР БО ФНС, годовая бухгалтерская отчётность']] }
      ]
    }
  };
  return Object.assign(r, over || {});
}

test('год ×1033 к прошлому и от 1 млрд ₽ — не сверен: ряды, показатели, разделы, светофор, вывод', () => {
  const r = I.dopolnit(otvet());
  assert.deepStrictEqual(r.sverka_dohodov.map((x) => [x.god, x.proshlyj.god, Math.round(x.kratno)]), [[2025, 2024, 1033]]);
  assert.deepStrictEqual(r.dossier.charts.revenue.map((x) => x.year), [2022, 2023, 2024]);
  assert.deepStrictEqual(r.dossier.charts.profit.map((x) => x.year), [2022, 2023, 2024]);
  const k = r.dossier.kpi;
  assert.deepStrictEqual(k[0], { label: 'Выручка за 2024', value: 31438000, delta: 46, good_up: true });
  assert.deepStrictEqual(k[1], { label: 'Чистая прибыль за 2024', value: 9388000, delta: 138, good_up: true });
  assert.ok(!k.some((x) => /^Налоговая нагрузка/.test(x.label)), 'нагрузка считалась от не сверенных доходов');
  assert.ok(k.some((x) => x.label === 'Активы') && k.some((x) => x.label === 'Сотрудники'), 'остальное не трогаем');
  const fin = r.dossier.sections[0], dyn = r.dossier.sections[1];
  assert.deepStrictEqual(fin.rows.map((x) => x[0]), ['Уплачено налогов и взносов', 'Данные на']);
  assert.match(bezNb(fin.comment), /^Доходы за 2025 год в открытых данных ФНС — 32 461 319 000 ₽, в 1 033 раза больше, чем за 2024 год \(31 438 000 ₽\)\./);
  assert.match(bezNb(fin.comment), /bo\.nalog\.gov\.ru\.$/);
  assert.deepStrictEqual(dyn.rows.map((x) => x[0]), ['2023', '2024', 'Текущая ликвидность', 'Источник']);
  assert.strictEqual(bezNb(dyn.comment), 'Год 2025 не показываем: доходы в открытых данных ФНС не сходятся с прошлыми годами. Оборотных средств хватает, чтобы покрыть текущие долги.');
  const s = r.signals.filter((x) => x.sverka_dohodov);
  assert.strictEqual(s.length, 1);
  assert.strictEqual(r.signals.indexOf(s[0]), 2, 'на месте строки нагрузки');
  assert.ok(!r.signals.some((x) => /^Низкая налоговая нагрузка/.test(x.title)));
  assert.strictEqual(s[0].status, 'not_checked', 'нейтральная строка, не минус');
  assert.strictEqual(bezNb(s[0].title), 'Доходы за 2025 год');
  assert.strictEqual(bezNb(s[0].detail), 'Не сверены: в 1 033 раза больше, чем за 2024 год — в оценку не взяли');
  assert.strictEqual(r.verdict, 'Работать можно с осторожностью: обратите внимание — задолженность по налогам. Перед крупной оплатой запросите документы и сохраните их в деле.');
});

test('повторный вызов ничего не меняет (Паспорт и отчёт зовут ispravitOtvet ещё раз)', () => {
  const r = IM.ispravitOtvet(otvet()), a = JSON.stringify(r);
  I.dopolnit(r); IM.ispravitOtvet(r);
  assert.strictEqual(JSON.stringify(r), a);
});

test('«Деньги на кону» — против выручки последнего сверенного года по ГИР БО', () => {
  const r = I.dopolnit(otvet());
  assert.deepStrictEqual(r.dengi.vyruchka, { summa: 31438000, god: 2024, istochnik: 'ГИР БО ФНС, годовая бухгалтерская отчётность', zamena_za: 2025 });
  const o = DNK.raschet(r, new Date('2026-11-14T10:00:00+03:00'));
  assert.strictEqual(o.vyruchka.god, 2024);
  assert.strictEqual(o.porog, 'malaya'); // 2,1 млн из 31,4 млн — 6,7 %
  assert.ok(Math.abs(o.dolya - 2100000 / 31438000) < 1e-9);
  assert.match(bezNb(DNK.html(o)), /выручка за 2024 год по бухгалтерской отчётности \(ГИР БО\): 31,4 млн ₽/);
});

test('Индекс: крупная недоимка — против сверенной выручки, а не против ×1000', () => {
  const r0 = otvet(); IM.ispravitOtvet(r0);
  // 2,1 млн ₽ недоимки = 6,7 % сверенной выручки 2024 → больше 5 % → крупная
  assert.strictEqual(IO.izOtveta(r0).fakty.nedoimka_krupnaya, true);
  // контроль: без сверки (×1000) та же недоимка была бы «обычной» — риск занижался
  const r1 = otvet(); r1.company.name_short = 'ООО «ПРИМЕР»';
  assert.ok(!IO.izOtveta(r1).fakty.nedoimka_krupnaya);
});

test('прошлый год 0 ₽ — сравниваем с последним годом, где выручка была', () => {
  const r = otvet();
  r.dossier.charts.revenue = [{ year: 2021, value: 1512000 }, { year: 2022, value: 0 }, { year: 2024, value: 0 }, { year: 2025, value: 24133479000 }];
  r.dossier.charts.profit = [{ year: 2024, value: 0 }, { year: 2025, value: 0 }];
  r.dossier.kpi[0] = { label: 'Выручка за 2025', value: 24133479000, delta: null, good_up: true };
  I.dopolnit(r);
  assert.deepStrictEqual(r.sverka_dohodov.map((x) => [x.god, x.proshlyj.god, Math.round(x.kratno)]), [[2025, 2021, 15961]]);
  assert.strictEqual(bezNb(r.signals.filter((x) => x.sverka_dohodov)[0].detail), 'Не сверены: в 15 961 раз больше, чем за 2021 год — в оценку не взяли');
  assert.deepStrictEqual(r.dossier.kpi[0], { label: 'Выручка за 2024', value: 0, delta: null, good_up: true });
  // последний сверенный год без выручки → «Деньги на кону» сравнить не с чем, процента нет
  assert.strictEqual(r.dengi.vyruchka.summa, null);
  assert.strictEqual(DNK.raschet(r, new Date('2026-11-14T10:00:00+03:00')).porog, 'bez_vyruchki');
});

test('строки нагрузки нет — честная строка добавляется в конец светофора', () => {
  const r = otvet(); r.signals = r.signals.slice(0, 2);
  I.dopolnit(r);
  assert.strictEqual(r.signals.length, 3);
  assert.strictEqual(r.signals[2].id, 'sverka_dohodov');
});

test('настоящий рост и обычные компании не трогаем', () => {
  // ×50 при 2 млрд ₽ — рост, не ошибка единиц
  const a = otvet(); a.dossier.charts.revenue[3].value = 50 * 31438000 + 1e9; // ×82, 2,6 млрд ₽
  I.dopolnit(a);
  assert.ok(!a.sverka_dohodov);
  // ×150, но меньше 1 млрд ₽ (стартап из 2 млн в 300 млн) — тоже не трогаем
  const b = otvet(); b.dossier.charts.revenue = [{ year: 2024, value: 2000000 }, { year: 2025, value: 300000000 }];
  I.dopolnit(b); assert.ok(!b.sverka_dohodov);
  // живой 5029124262 (14.11): ровный ряд 1,1–1,9 млрд ₽ — без изменений, кроме кавычек
  const c = otvet(); c.dossier.charts.revenue = [{ year: 2023, value: 1806186000 }, { year: 2024, value: 1527118000 }, { year: 2025, value: 1129308000 }];
  const c0 = JSON.parse(JSON.stringify(c)); I.dopolnit(c);
  assert.deepStrictEqual(c.dossier, c0.dossier); assert.deepStrictEqual(c.signals, c0.signals); assert.strictEqual(c.verdict, c0.verdict);
  // ответа без досье (ИП, ошибка) — нет падения
  assert.doesNotThrow(() => I.dopolnit({ company: { inn: '770000000001', kind: 'INDIVIDUAL' } }));
  assert.doesNotThrow(() => I.sverkaDohodov(null));
});

test('«Активы» ×100+ к прошлому году в том же ответе — тоже не показываем; без сверки — остаются', () => {
  const r = otvet(); r.dossier.kpi[2] = { label: 'Активы', value: 2058947000, delta: 13447, good_up: true };
  I.dopolnit(r); assert.ok(!r.dossier.kpi.some((x) => x.label === 'Активы'));
  const c = otvet(); c.dossier.charts.revenue[3].value = 32461319; c.dossier.kpi[2] = { label: 'Активы', value: 2058947000, delta: 13447, good_up: true };
  I.dopolnit(c); assert.ok(c.dossier.kpi.some((x) => x.label === 'Активы'));
});

test('модуль без конструкций, которые роняют старые Safari (look-behind в регулярных выражениях)', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'js', 'istochniki.js'), 'utf8');
  assert.ok(!/\(\?<[=!]/.test(t));
});

test('«Динамика» на экране проверки: строка «Год не сверен» под таблицей, без не сверенного года', () => {
  const DIN = require('../js/dinamika.js');
  const r = I.dopolnit(otvet());
  const h = bezNb(DIN.htmlDinamika(r));
  assert.match(h, /data-blok="sverka-dohodov"><b>Год не сверен\.<\/b> Доходы за 2025 год в открытых данных ФНС — 32 461 319 000 ₽/);
  assert.match(h, /Динамика за 2022–2024/);
  assert.ok(!/32,5 млрд/.test(h));
  assert.strictEqual(DIN.sverkaHtml(otvet()), '');
});

// sverka-dohodov-v2 [Ночные запуски] 14.11 12:20 — живой отчёт 7453199651 после v1 (deloskop.ru/?inn=…, Chromium):
// «Налог на прибыль 2025 — 266,1 млн ₽ ▲ в 390 раз» в «Динамике» и «Собственный капитал 2,1 млрд ₽» в «На чём держится компания».
function otvetBalans() {
  const r = otvet();
  const D = r.dossier;
  D.kpi = [
    { label: 'Выручка за 2025', value: 25186967000, delta: 114930, good_up: true },
    { label: 'Чистая прибыль за 2025', value: 2040447000, delta: 251187, good_up: true },
    { label: 'Активы', value: 2058947000, delta: 13447, good_up: true },
    { label: 'Собственный капитал', value: 2058947000, delta: null, good_up: true },
    { label: 'Налоги и взносы за год', value: 594781, delta: null, good_up: true },
    { label: 'Сотрудники', value: null, text: '4 чел.', delta: null, good_up: true }];
  D.charts = {
    revenue: [{ year: 2023, value: 31845000 }, { year: 2024, value: 21896000 }, { year: 2025, value: 25186967000 }],
    profit: [{ year: 2023, value: 1370000 }, { year: 2024, value: 812000 }, { year: 2025, value: 2040447000 }],
    income_tax: [{ year: 2023, value: 444000 }, { year: 2024, value: 683000 }, { year: 2025, value: 266147000 }],
    balance: { year: 2025, equity: 2058947000, long_debt: 0, short_debt: 0 }
  };
  D.sections[1].rows = [['2024', 'выручка 21,9 млн ₽, прибыль 812 000 ₽'], ['2025', 'выручка 25,2 млрд ₽, прибыль 2,0 млрд ₽'], ['Средний рост выручки в год', '397,3 %'],
    ['Доля заёмных средств', '0,0 %'], ['Деньги на счетах', '1,6 млрд ₽'], ['Источник', 'ГИР БО ФНС, годовая бухгалтерская отчётность']];
  D.sections[1].comment = 'Бизнес растёт: выручка в среднем +397 % в год. Оборотных средств хватает, чтобы покрыть текущие долги.';
  return r;
}

test('v2: налог на прибыль не сверенного года снят вместе с выручкой', () => {
  const r = I.dopolnit(otvetBalans());
  assert.deepStrictEqual(r.dossier.charts.income_tax.map((x) => x.year), [2023, 2024]);
});

test('v2: баланс того же года с «Активами» ×100+ — не показываем: ряд, показатели, строки и фраза о долгах', () => {
  const r = I.dopolnit(otvetBalans());
  assert.ok(!('balance' in r.dossier.charts), 'капитал 2,1 млрд ₽ на 31.12.2025 — того же не сверенного года');
  assert.deepStrictEqual(r.sverka_balansa, { god: 2025, kratno: 135.47 });
  const L = r.dossier.kpi.map((x) => x.label);
  assert.ok(!L.includes('Активы') && !L.includes('Собственный капитал'), L.join(' · '));
  assert.ok(L.includes('Налоги и взносы за год') && L.includes('Сотрудники'), 'не баланс — не трогаем');
  const dyn = r.dossier.sections[1];
  assert.deepStrictEqual(dyn.rows.map((x) => x[0]), ['2024', 'Источник']);
  assert.ok(!/Оборотных средств/.test(dyn.comment), dyn.comment);
  assert.match(bezNb(r.sverka_dohodov_tekst), /Баланс на 31\.12\.2025 из того же ответа тоже вырос в 135 раз — его не показываем\.$/);
});

test('v2: баланс не сверенного года без скачка «Активов» — оставляем (0105053225: капитал 12,9 млн ₽)', () => {
  const r = I.dopolnit(otvet());
  assert.deepStrictEqual(r.dossier.charts.balance, { year: 2025, equity: 12947000, long_debt: 0, short_debt: 10000 });
  assert.ok(!r.sverka_balansa);
  assert.ok(!/Баланс на/.test(r.sverka_dohodov_tekst));
  assert.ok(r.dossier.sections[1].rows.some((x) => x[0] === 'Текущая ликвидность'));
});

test('v2: ровный ряд — ни налог, ни баланс не трогаем', () => {
  const r = otvetBalans();
  r.dossier.charts.revenue[2].value = 25186967; r.dossier.kpi[2].delta = 13;
  I.dopolnit(r);
  assert.strictEqual(r.dossier.charts.income_tax.length, 3);
  assert.ok(r.dossier.charts.balance);
});
