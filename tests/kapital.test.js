// Существенный факт «Собственный капитал» — только когда он меньше нуля (js/sushchestvennoe.js, kapital-v1);
// «Как посчитали предел» — полнота внешних реестров без противоречия с «Откуда данные» (js/usloviya.js).
// node --test tests/kapital.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');
const U = require('../js/usloviya.js');
const NB = '\u00a0';

function otvet(balance, over) {
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
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 48.2e6 }], charts: { revenue: [{ year: 2025, value: 48.2e6 }], balance: balance } },
  }, over || {});
}

test('капитал меньше нуля — жёлтый факт среди первых, с источником и датой баланса', () => {
  const f = S.fakty(otvet({ year: 2025, equity: -12.4e6, long_debt: 0, short_debt: 30e6 }));
  const k = f.spisok.find((x) => x.k === 'kapital');
  assert.ok(k, 'факт есть в первых 7');
  assert.strictEqual(f.spisok[0].k, 'kapital', 'жёлтый — раньше зелёных');
  assert.strictEqual(k.ton, 'warn');
  assert.strictEqual(k.nazv, 'Собственный капитал на' + NB + '31.12.2025');
  assert.strictEqual(k.znach, 'Минус 12,4' + NB + 'млн' + NB + '₽: обязательства больше активов');
  assert.strictEqual(k.ist, 'ГИР БО ФНС, баланс');
  assert.strictEqual(k.data, '31.12.2025');
  assert.strictEqual(f.spisok.length, 7, 'не больше 7 строк');
  assert.strictEqual(f.eshche.length, 1, 'вытесненный зелёный факт — в «Все данные из реестров»');
  assert.match(S.html(otvet({ year: 2025, equity: -12.4e6 })), /data-fakt="kapital"/);
});

test('капитал в плюсе, ноль, пусто, мусор — факта нет (решение не меняет)', () => {
  for (const b of [{ year: 2025, equity: 16.4e12 }, { year: 2025, equity: 0 }, { year: 2025, equity: null }, { year: 2025, equity: '' },
    { year: 2025, equity: 'нет' }, { year: 2025, equity: true }, { equity: -5e6 }, null, undefined, 'строка']) {
    const f = S.fakty(otvet(b));
    assert.ok(!f.spisok.concat(f.eshche).some((x) => x.k === 'kapital'), JSON.stringify(b));
  }
  assert.deepStrictEqual(S.fakty(otvet({ year: 2025, equity: 1e6 })).spisok.map((x) => x.k),
    ['status', 'address', 'tax_debt', 'otchetnost', 'rukovoditel', 'age', 'zsk'], 'чистая компания — прежние 7 фактов');
});

test('капитал — строкой из API тоже считается; у ИП баланса не показываем', () => {
  assert.deepStrictEqual(S.kapital(otvet({ year: '2024', equity: '-3000000' })), { god: 2024, znach: -3e6 });
  const ip = otvet({ year: 2025, equity: -1e6 }, { company: { inn: '770000000012', kind: 'INDIVIDUAL', status: 'ACTIVE' } });
  assert.ok(!S.fakty(ip).spisok.some((x) => x.k === 'kapital'));
});

test('факт без обещаний и оценок сверх данных', () => {
  const k = S.fakty(otvet({ year: 2025, equity: -1e6 })).spisok.find((x) => x.k === 'kapital');
  const t = k.nazv + ' ' + k.znach;
  assert.doesNotMatch(t, /банкрот|однодневк|мошен|гарант|надёжн|опасн|не плат/i);
});

test('«Как посчитали»: внешние реестры отдельно от всех источников — нет «Проверено 0 из 7» рядом с «ответили 3 из 10»', () => {
  const r = otvet({ year: 2025, equity: 1e6 }, { damia: { polnota: { provereno: 0, iz: 7 }, fssp: { nazvanie: 'Приставы', status: 'ne_provereno' } } });
  const v = U.decide(r);
  assert.match(v.kak.ne, / Из внешних реестров ответили 0 из 7 на 02\.10\.2026\.$/);
  assert.doesNotMatch(v.kak.ne, /Проверено \d+ из \d+ источников/);
});
