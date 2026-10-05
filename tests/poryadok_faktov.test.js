// poryadok-faktov-v1 [Ночные-3]: порядок «Существенных фактов» (js/sushchestvennoe.js).
// Живой ответ /api/check 05.10 (ООО, 367 сотрудников, замечаний нет): строка «Сотрудники · 367 чел.» стояла первой —
// выше статуса — и вытесняла прогноз ЗСК в «Все данные из реестров». Признак без замечаний решения не меняет.
// node --test tests/poryadok_faktov.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');

function otvet(sig) {
  return {
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2001-02-26', director_since: '2022-01-20', okved: '46.73.6' },
    risk_level: 'low', checked_at: '2026-10-05',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 26.02.2001', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
      sig,
    ],
    zsk: { level: 'low', title: 'Низкая вероятность', cbr_url: 'https://www.cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/' },
    dossier: { charts: { revenue: [{ year: 2025, value: 11697331000 }], profit: [{ year: 2025, value: 398845000 }] } },
  };
}
const kluchi = (r) => S.fakty(r).spisok.map((f) => f.k);

test('«Сотрудники» без замечаний — не выше статуса и не вытесняет прогноз ЗСК', () => {
  const k = kluchi(otvet({ id: 'employees', title: 'Сотрудники', status: 'ok', detail: '367 чел.', source: 'ФНС, открытые данные', as_of: '31.12.2025' }));
  assert.strictEqual(k[0], 'status');
  assert.ok(k.includes('zsk'), 'прогноз ЗСК среди существенных: ' + k.join(','));
  assert.ok(!k.includes('employees'), '7 строк заняты базовыми фактами — штат уходит в «Все данные»: ' + k.join(','));
  assert.ok(k.length <= 7);
});

test('«Сотрудники» с замечанием (0 человек) — среди первых, как раньше', () => {
  const k = kluchi(otvet({ id: 'employees', title: 'Сотрудники', status: 'warn', detail: '0 чел.', source: 'ФНС, открытые данные', as_of: '31.12.2025' }));
  assert.strictEqual(k[0], 'employees');
});

test('незнакомый признак API: с замечанием — первым, без замечаний — после базовых', () => {
  assert.strictEqual(kluchi(otvet({ id: 'novyj_priznak', title: 'Новый признак', status: 'bad', detail: 'Есть' }))[0], 'novyj_priznak');
  const k = kluchi(otvet({ id: 'novyj_priznak', title: 'Новый признак', status: 'ok', detail: 'Нет' }));
  assert.strictEqual(k[0], 'status');
  assert.ok(k.indexOf('novyj_priznak') < 0 || k.indexOf('novyj_priznak') > k.indexOf('zsk'));
});
