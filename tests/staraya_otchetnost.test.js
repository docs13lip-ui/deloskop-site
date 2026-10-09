// staraya-otchetnost-v1 [Ночные-3] 10.10: последняя открытая отчётность старше (год проверки по Москве − 2) —
// «последняя открытая», а не текущая (ТЗ [Продукт] 10.10 01:40, разд. 2.2 и 3 п. Б).
// Живой ответ /api/check 10.10 (крупная торговая сеть): kpi «Выручка за 2021», «Активы» без года, charts за 2020–2021,
// при «проверено 10.10.2026» — ни слова, что за 2022–2025 открытых данных нет.
// Форма ответа — как на живом; суммы и компания — условные.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'sushchestvennoe.js'));
const DN = require(path.join(ROOT, 'js', 'dinamika.js'));
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const NB = '\u00a0';
const TEKST = 'Последняя открытая отчётность — за' + NB + '2021' + NB + 'год. Более свежей в' + NB + 'открытых данных ГИР' + NB + 'БО нет — запросите отчётность у' + NB + 'компании.';

const POD = 'Более свежей в' + NB + 'открытых данных ГИР' + NB + 'БО нет — запросите отчётность у' + NB + 'компании.';

function otvet(gody, o) {
  o = o || {};
  const g1 = gody[gody.length - 1];
  return {
    checked_at: o.checked_at || '2026-10-10', risk_level: 'low',
    company: { inn: o.inn || '7800000002', ogrn: '1027800000002', kind: o.inn && o.inn.length === 12 ? 'INDIVIDUAL' : 'LEGAL', name_short: 'ООО «Пример»', status: 'ACTIVE', reg_date: '2003-11-04', okved: '47.11' },
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' }],
    dossier: {
      kpi: [{ label: 'Выручка за ' + g1, value: 500000000000 }, { label: 'Чистая прибыль за ' + g1, value: 3000000000 }, { label: 'Активы', value: 250000000000 },
        { label: 'Долг перед бюджетом', value: null, text: 'Нет' }],
      charts: {
        revenue: gody.map((g, i) => ({ year: g, value: 400e9 + i * 30e9 })),
        profit: gody.map((g, i) => ({ year: g, value: 10e9 - i * 2e9 })),
        balance: { year: g1, equity: 80000000000, long_debt: 75000000000, short_debt: 95000000000 },
        debts: { year: g1, receivables: 25000000000, payables: 70000000000, loans: 90000000000 },
      },
    },
  };
}

test('правило: старше (год проверки − 2) — старая; 2024 и 2025 в октябре 2026 — нет; без годов — null', () => {
  assert.strictEqual(S.staraya(otvet([2020, 2021])).god, 2021);
  assert.strictEqual(S.staraya(otvet([2020, 2021])).tekst, TEKST);
  assert.strictEqual(S.staraya(otvet([2023])).god, 2023);
  assert.strictEqual(S.staraya(otvet([2023, 2024])), null);
  assert.strictEqual(S.staraya(otvet([2024, 2025])), null);
  // год проверки — по Москве: 31.12.2026 22:30 UTC — уже 2027, 2024 становится старой
  assert.strictEqual(S.staraya(otvet([2024], { checked_at: '2026-12-31T22:30:00Z' })).god, 2024);
  assert.strictEqual(S.staraya(otvet([2024], { checked_at: '2026-12-31T20:30:00Z' })), null);
  const pust = otvet([2021]); pust.dossier = { kpi: [], charts: {} };
  assert.strictEqual(S.staraya(pust), null, 'нет ни одного года — это случай «Нет в ответе ГИР БО», не старая отчётность');
  // свежий баланс при старой выручке — отчётность не старая (последний год — по всем рядам)
  const bal = otvet([2020, 2021]); bal.dossier.charts.balance.year = 2025;
  assert.strictEqual(S.staraya(bal), null);
});

test('одна функция в трёх модулях: сайт, PDF-досье и Паспорт не расходятся', () => {
  const sl = [otvet([2020, 2021]), otvet([2024, 2025]), otvet([2019, 2020, 2021, 2022]), otvet([2024], { checked_at: '2027-01-01T00:30:00+03:00' })];
  sl.forEach((r) => {
    assert.deepStrictEqual(DN.staraya(r), S.staraya(r));
    assert.deepStrictEqual(P.staraya(r), S.staraya(r));
  });
});

test('существенные факты: «Выручка за 2021 · последняя открытая», тон «внимание», подстрочник и «почему так бывает»', () => {
  const f = S.fakty(otvet([2020, 2021]));
  const o = f.spisok.find((x) => x.k === 'otchetnost');
  assert.ok(o, 'строка отчётности — среди существенных');
  assert.strictEqual(o.nazv, 'Выручка за 2021 · последняя открытая');
  assert.strictEqual(o.ton, 'warn');
  assert.strictEqual(o.data, '31.12.2021');
  assert.strictEqual(o.pod, POD);
  assert.strictEqual(o.spravka, '/nalogi/net-otchetnosti-v-otkrytyh-dannyh/');
  assert.strictEqual(f.spisok[0].k, 'otchetnost', 'замечание — выше строк без замечаний');
  const h = S.html(otvet([2020, 2021]));
  assert.ok(h.includes('<small class="sut__pod">' + POD + '</small>'));
  assert.ok(S.CSS.includes('.sut__pod'));
});

test('существенные факты: свежая отчётность — как было (без «последняя открытая», тон нейтральный, без подстрочника)', () => {
  const o = S.fakty(otvet([2023, 2024, 2025])).spisok.find((x) => x.k === 'otchetnost');
  assert.strictEqual(o.nazv, 'Выручка за 2025');
  assert.strictEqual(o.ton, 'neutral');
  assert.ok(!o.pod && !o.spravka);
  assert.ok(!S.html(otvet([2023, 2024, 2025])).includes('sut__pod'));
});

test('существенные факты: отчёт без выручки за старый год — тоже «последняя открытая»', () => {
  const r = otvet([2020, 2021]);
  r.dossier.charts.revenue = []; r.dossier.kpi = [{ label: 'Выручка за 2021', value: null }];
  const o = S.fakty(r).spisok.concat(S.fakty(r).eshche).find((x) => x.k === 'otchetnost');
  assert.strictEqual(o.nazv, 'Выручка за 2021 · последняя открытая');
  assert.ok(o.znach.startsWith('В' + NB + 'отчёте не' + NB + 'указана'));
  assert.strictEqual(o.ton, 'warn');
});

test('динамика: строка о старой отчётности над таблицей и над отдельным балансом', () => {
  const h = DN.htmlDinamika(otvet([2017, 2018, 2019, 2020, 2021]));
  assert.ok(h.includes('<p class="din__star" data-blok="staraya">' + TEKST + '</p>'));
  assert.ok(h.indexOf('din__star') < h.indexOf('<table'), 'предупреждение — до таблицы');
  // два года — таблицы нет (нужно ≥ 3), но баланс показывается отдельно — с той же строкой
  const b = DN.htmlBalansOtdelno ? DN.htmlBalansOtdelno(otvet([2020, 2021])) : DN.html(otvet([2020, 2021]));
  assert.ok(b.includes('din__star'), 'отдельный баланс за 2021 тоже подписан');
  assert.ok(!DN.htmlDinamika(otvet([2021, 2022, 2023, 2024, 2025])).includes('din__star'));
});

test('Паспорт: первая строка «Финансов» — последняя открытая отчётность, тон «внимание»; у «Активов» — дата баланса', () => {
  const p = P.sobrat(otvet([2020, 2021]), { usloviya: U, indeksVorota: IV });
  const r6 = p.razdely.find((x) => x.id === 'finansy');
  assert.strictEqual(r6.fakty[0].tekst, 'Последняя открытая отчётность');
  assert.ok(r6.fakty[0].znachenie.startsWith('за' + NB + '2021' + NB + 'год. Более свежей'));
  assert.strictEqual(r6.fakty[0].ton, 'warn');
  assert.strictEqual(r6.ton, 'warn');
  const akt = r6.fakty.find((f) => f.tekst === 'Активы');
  assert.strictEqual(akt.data, '2021-12-31');
  assert.strictEqual(r6.fakty.find((f) => f.tekst === 'Выручка за 2021').data, '2021-12-31');
  const svezh = P.sobrat(otvet([2024, 2025]), { usloviya: U, indeksVorota: IV }).razdely.find((x) => x.id === 'finansy');
  assert.ok(!svezh.fakty.some((f) => f.tekst === 'Последняя открытая отчётность'));
  assert.strictEqual(svezh.fakty.find((f) => f.tekst === 'Активы').data, '2025-12-31');
});
