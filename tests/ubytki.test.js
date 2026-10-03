// «Убыток N лет подряд» — существенный факт по годовой отчётности (js/sushchestvennoe.js, ubytki-v1)
// и строка «Что изменилось» при новой отчётности (js/dinamika.js).
// node --test tests/ubytki.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');
const D = require('../js/dinamika.js');
const NB = ' ';

function otvet(profit, over) {
  const rev = profit.map((p) => ({ year: p.year, value: 50e6 }));
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', director_since: '2019-05-20', okved: '46.90' },
    risk_level: 'low', checked_at: '2026-10-02T09:00:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ' },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    zsk: { level: 'low', title: 'Низкая вероятность' },
    dossier: { charts: { revenue: rev, profit: profit } },
  }, over || {});
}
const P = (pairs) => pairs.map(([year, value]) => ({ year, value }));

test('два убыточных года подряд — жёлтый факт среди первых, с источником и датой', () => {
  const f = S.fakty(otvet(P([[2023, 4e6], [2024, -1.2e6], [2025, -3.1e6]])));
  const u = f.spisok.find((x) => x.k === 'ubytki');
  assert.ok(u, 'факт есть в первых 7');
  assert.strictEqual(f.spisok[0].k, 'ubytki', 'жёлтый — раньше зелёных');
  assert.strictEqual(u.ton, 'warn');
  assert.strictEqual(u.nazv, 'Убыток 2' + NB + 'года подряд');
  assert.strictEqual(u.znach, 'По годовой отчётности за 2024 и 2025');
  assert.strictEqual(u.ist, 'ГИР БО ФНС, отчёт о финансовых результатах');
  assert.strictEqual(u.data, '31.12.2025');
  assert.ok(f.spisok.length <= 7, 'не больше 7 строк');
  assert.match(S.html(otvet(P([[2024, -1], [2025, -2]]))), /data-fakt="ubytki"/);
});

test('серия 3 и 5 лет — диапазоном, склонение', () => {
  assert.deepStrictEqual(S.ubytki(otvet(P([[2022, 1], [2023, -1], [2024, -1], [2025, -1]]))), { god: 2025, n: 3, ot: 2023 });
  const f5 = S.fakty(otvet(P([[2021, -1], [2022, -1], [2023, -1], [2024, -1], [2025, -1]])));
  const u = f5.spisok.find((x) => x.k === 'ubytki');
  assert.strictEqual(u.nazv, 'Убыток 5' + NB + 'лет подряд');
  assert.strictEqual(u.znach, 'По годовой отчётности за 2021–2025');
});

test('нет факта: один убыточный год, прибыль в последнем году, ноль, пропуск года, мусор, ИП', () => {
  const nety = [
    P([[2024, 5e6], [2025, -1e6]]),           // один год — уже виден в строке «Выручка за 2025 · убыток»
    P([[2023, -1], [2024, -1], [2025, 2]]),   // серия оборвалась прибылью — решение не меняет
    P([[2024, -1], [2025, 0]]),               // ноль — не убыток
    P([[2023, -1], [2025, -1]]),              // 2024 нет в ряду — «не знаем» ≠ «убыток»
    [{ year: 2024, value: null }, { year: 2025, value: -1 }],
    [{ year: 2024, value: '' }, { year: 2025, value: -1 }],
    [{ year: 2024, value: true }, { year: 2025, value: -1 }],
    [{ value: -1 }, { year: 2025, value: -1 }],
    [], null, 'строка',
  ];
  for (const p of nety) {
    const f = S.fakty(otvet(Array.isArray(p) ? p : [], { dossier: { charts: { profit: p } } }));
    assert.ok(!f.spisok.concat(f.eshche).some((x) => x.k === 'ubytki'), JSON.stringify(p));
  }
  const ip = otvet(P([[2024, -1], [2025, -1]]), { company: { inn: '770000000012', kind: 'INDIVIDUAL', status: 'ACTIVE' } });
  assert.ok(!S.fakty(ip).spisok.some((x) => x.k === 'ubytki'), 'у ИП отчётности ГИР БО нет');
});

test('строки из API тоже считаются; порядок ряда неважен', () => {
  assert.deepStrictEqual(S.ubytki(otvet([{ year: '2025', value: '-3000000' }, { year: '2024', value: '-1' }])), { god: 2025, n: 2, ot: 2024 });
});

test('факт без обещаний и оценок сверх данных', () => {
  const u = S.fakty(otvet(P([[2024, -1], [2025, -1]]))).spisok.find((x) => x.k === 'ubytki');
  assert.doesNotMatch(u.nazv + ' ' + u.znach, /банкрот|однодневк|мошен|гарант|надёжн|опасн|не плат|проверк[уа] налог/i);
});

// ---- «Что изменилось» ----
function snimok(profit, checked) {
  return D.snimok(otvet(profit, { checked_at: checked }));
}

test('новая отчётность довела убытки до 2 лет подряд — красная строка', () => {
  const a = snimok(P([[2023, 2e6], [2024, -1e6]]), '2025-06-01T09:00:00Z');
  const b = snimok(P([[2023, 2e6], [2024, -1e6], [2025, -2e6]]), '2026-10-02T09:00:00Z');
  assert.deepStrictEqual(b.ub, [2025, 2]);
  const izm = D.sravnit(a, b);
  const x = izm.find((q) => /подряд/.test(q.t));
  assert.ok(x, JSON.stringify(izm));
  assert.strictEqual(x.ton, 'huzhe');
  assert.strictEqual(x.t, 'Убыток 2' + NB + 'года подряд: по годовой отчётности за 2024 и 2025 (ГИР' + NB + 'БО)');
  assert.strictEqual(izm[0].ton, 'huzhe', 'хуже — первыми');
});

test('третий год подряд — тоже красная, с диапазоном; старый снимок без поля ub сравнивается по году прибыли', () => {
  const a = snimok(P([[2023, -1], [2024, -1]]), '2025-06-01T09:00:00Z');
  delete a.ub;
  const b = snimok(P([[2023, -1], [2024, -1], [2025, -1]]), '2026-10-02T09:00:00Z');
  const x = D.sravnit(a, b).find((q) => /подряд/.test(q.t));
  assert.strictEqual(x.t, 'Убыток 3' + NB + 'года подряд: по годовой отчётности за 2023–2025 (ГИР' + NB + 'БО)');
});

test('молчим: та же отчётность, серия меньше 2 лет, прибыль после убытков, старый снимок без года', () => {
  const p2 = P([[2024, -1], [2025, -1]]);
  assert.ok(!D.sravnit(snimok(p2, '2026-09-01T09:00:00Z'), snimok(p2, '2026-10-02T09:00:00Z')).some((q) => /подряд/.test(q.t)), 'отчётность та же');
  const a = snimok(P([[2023, 1], [2024, 1]]), '2025-06-01T09:00:00Z');
  assert.ok(!D.sravnit(a, snimok(P([[2023, 1], [2024, 1], [2025, -1]]), '2026-10-02T09:00:00Z')).some((q) => /подряд/.test(q.t)), 'один год');
  const c = snimok(P([[2023, -1], [2024, -1]]), '2025-06-01T09:00:00Z');
  const d = snimok(P([[2023, -1], [2024, -1], [2025, 5]]), '2026-10-02T09:00:00Z');
  const izm = D.sravnit(c, d);
  assert.ok(!izm.some((q) => /подряд/.test(q.t)), 'серия оборвалась');
  assert.ok(izm.some((q) => q.ton === 'luchshe' && /прибыль/.test(q.t)), 'прибыль после убытка — зелёная, как раньше');
  const e = snimok(P([[2024, 1]]), '2025-06-01T09:00:00Z');
  delete e.prib; delete e.ub;
  assert.ok(!D.sravnit(e, snimok(p2, '2026-10-02T09:00:00Z')).some((q) => /подряд/.test(q.t)), 'нет года — не сравниваем');
});
