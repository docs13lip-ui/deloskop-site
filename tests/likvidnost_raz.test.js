// likvidnost-v1: «Текущая ликвидность меньше 1» — в существенных фактах (js/sushchestvennoe.js)
// и рост «в 28 раз» вместо «+2680 %» в «Динамике за 3–5 лет» (js/dinamika.js).
// node --test tests/likvidnost_raz.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');
const D = require('../js/dinamika.js');
const NB = '\u00a0';

// Форма живого ответа /api/check 03.10 (ПАО, раздел досье dynamics; суммы округлены)
function otvet(likv, over) {
  const r = {
    company: { inn: '7740000076', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2000-03-01', director_since: '2025-02-25', okved: '61.20.2' },
    risk_level: 'low', checked_at: '2026-10-03T00:00:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ' },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 01.03.2000', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    zsk: { level: 'low', title: 'Низкая вероятность' },
    dossier: {
      sections: [{ id: 'dynamics', title: 'Финансовая динамика по годам', tone: 'warn', rows: [
        ['2025', 'выручка 476,8 млрд ₽, прибыль 26,0 млрд ₽'], ['Доля заёмных средств', '91,7 %'],
        ['Текущая ликвидность', likv], ['Источник', 'ГИР БО ФНС, годовая бухгалтерская отчётность']] }],
      charts: {
        revenue: [{ year: 2024, value: 458.2e9 }, { year: 2025, value: 476.8e9 }],
        profit: [{ year: 2024, value: 37.5e9 }, { year: 2025, value: 26.0e9 }],
        balance: { year: 2025, equity: 126.2e9, long_debt: 749e9, short_debt: 646.4e9 },
      },
    },
  };
  return Object.assign(r, over || {});
}

test('ликвидность меньше 1 — существенный факт «внимание» с источником и датой отчётности', () => {
  const f = S.fakty(otvet('0,22'));
  const l = f.spisok.find((x) => x.k === 'likvidnost');
  assert.ok(l, 'факт есть');
  assert.strictEqual(l.ton, 'warn');
  assert.strictEqual(l.nazv, 'Текущая ликвидность');
  assert.strictEqual(l.znach, '0,22: краткосрочные долги больше оборотных средств');
  assert.strictEqual(l.ist, 'ГИР БО ФНС, баланс');
  assert.strictEqual(l.data, '31.12.2025');
  assert.strictEqual(f.spisok[0].k, 'likvidnost', 'замечание — первым');
  assert.ok(f.spisok.length <= S.MAKS);
});

test('ликвидность 1 и выше, ноль, пусто, без года — факта нет', () => {
  for (const v of ['1', '1,00', '2,4', '0', '0,00', '', '—', 'нет данных']) {
    assert.ok(!S.fakty(otvet(v)).spisok.some((x) => x.k === 'likvidnost'), 'значение ' + JSON.stringify(v));
  }
  const bezGoda = otvet('0,5');
  delete bezGoda.dossier.charts.balance;
  assert.strictEqual(S.likvidnost(bezGoda), null, 'нет года баланса — нет даты — нет факта');
  bezGoda.dossier.charts.debts = { year: 2024 };
  assert.deepStrictEqual(S.likvidnost(bezGoda), { god: 2024, znach: 0.5 }, 'год — из charts.debts');
});

test('ИП — без факта ликвидности (как и без отчётности)', () => {
  const r = otvet('0,3');
  r.company = Object.assign({}, r.company, { inn: '500100732259', kind: 'INDIVIDUAL' });
  assert.ok(!S.fakty(r).spisok.some((x) => x.k === 'likvidnost'));
});

test('ликвидность читается только из раздела dynamics и с точкой тоже', () => {
  const r = otvet('0.75');
  assert.deepStrictEqual(S.likvidnost(r), { god: 2025, znach: 0.75 });
  r.dossier.sections[0].id = 'profile';
  assert.strictEqual(S.likvidnost(r), null);
});

test('факт ликвидности попадает в разметку экрана', () => {
  const h = S.html(otvet('0,22'));
  assert.ok(h.includes('data-fakt="likvidnost"'));
  assert.ok(h.includes('краткосрочные долги больше оборотных средств'));
});

test('рост в 3 раза и больше — «в N раз», ниже — проценты', () => {
  assert.strictEqual(D.izmenenie(100, 250), '+150' + NB + '%');
  assert.strictEqual(D.izmenenie(100, 80), '−20' + NB + '%');
  assert.strictEqual(D.izmenenie(100, 300), 'в' + NB + '3' + NB + 'раза');
  assert.strictEqual(D.izmenenie(100, 340), 'в' + NB + '3,4' + NB + 'раза');
  assert.strictEqual(D.izmenenie(100, 500), 'в' + NB + '5' + NB + 'раз');
  assert.strictEqual(D.izmenenie(361.8e6, 10.1e9), 'в' + NB + '28' + NB + 'раз');
  assert.strictEqual(D.izmenenie(100, 2100), 'в' + NB + '21' + NB + 'раз');
  assert.strictEqual(D.izmenenie(100, 2200), 'в' + NB + '22' + NB + 'раза');
  assert.strictEqual(D.izmenenie(1, 1500), 'в' + NB + '1' + NB + '500' + NB + 'раз');
});

test('«Динамика»: налог на прибыль 361,8 млн → 10,1 млрд — «▲ в 28 раз», переход через ноль — по-прежнему «из убытка»', () => {
  // znak-naloga-v1: в год убытка налог без знака не сравниваем — поэтому «в 28 раз» проверяем на прибыльных годах
  const r = { dossier: { charts: {
    revenue: [{ year: 2023, value: 422e9 }, { year: 2024, value: 458e9 }, { year: 2025, value: 477e9 }],
    profit: [{ year: 2023, value: 48e9 }, { year: 2024, value: 5e9 }, { year: 2025, value: 26e9 }],
    income_tax: [{ year: 2023, value: 400e6 }, { year: 2024, value: 361.8e6 }, { year: 2025, value: 10.1e9 }],
  } } };
  const h = D.htmlDinamika(r);
  assert.ok(h.includes('▲' + NB + 'в' + NB + '28' + NB + 'раз'), 'изменение к прошлому году словами');
  assert.ok(!/\d{4}\s?%/.test(h), 'нет четырёхзначных процентов');
  const t = D.stroka(D.ryady(r).find((x) => x.k === 'income_tax'));
  assert.strictEqual(t.zaPeriod, 'в' + NB + '25' + NB + 'раз с' + NB + '2023');
  const r2 = JSON.parse(JSON.stringify(r)); r2.dossier.charts.profit[1].value = -5e9;
  assert.ok(D.htmlDinamika(r2).includes('▲' + NB + 'из убытка'), 'смена знака прибыли — как раньше');
});
