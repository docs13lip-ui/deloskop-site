// zhivoj-otvet-v1 (04.10.2026, [Ночные-3]): модули экрана проверки читают поля так, как их отдаёт живой /api/check.
// Найдено отрисовкой живого ответа: js/rentabelnost.js брал balance.long_liab / short_liab, а API отдаёт
// long_debt / short_debt (их же читают js/dinamika.js и Паспорт) — «Рентабельность активов против отрасли»
// на живом не появлялась ни у одной компании, тесты шли на выдуманных ключах.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/rentabelnost.js');

// Форма и числа — из живого ответа /api/check по 7736050003 (04.10.2026), только нужные поля
const ZHIVOJ = {
  checked_at: '2026-10-04',
  company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', okved: '46.71.4' },
  dossier: { charts: {
    revenue: [{ year: 2024, value: 6256645316000 }, { year: 2025, value: 5846351786000 }],
    profit: [{ year: 2024, value: -1076270574000 }, { year: 2025, value: 11284564000 }],
    income_tax: [{ year: 2024, value: 96466375000 }, { year: 2025, value: 152751487000 }],
    balance: { year: 2025, equity: 16432222886000, long_debt: 6386347532000, short_debt: 2917757718000 },
    debts: { year: 2025, receivables: 1144646095000, payables: 1172282674000, loans: 4425697799000 }
  } }
};

test('живой ключ баланса: long_debt / short_debt → оценка рентабельности есть', () => {
  const o = R.ocenka(ZHIVOJ);
  assert.ok(o, 'оценки нет — модуль снова читает не те ключи');
  assert.strictEqual(o.god, 2025);
  assert.strictEqual(o.aktivy, 16432222886000 + 6386347532000 + 2917757718000);
  assert.strictEqual(o.sNalogom, true);
  assert.ok(Math.abs(o.n - (11284564000 + 152751487000) / o.aktivy * 100) < 1e-9);
});

test('ключи живого ответа во всех тестах рентабельности (не long_liab / short_liab)', () => {
  const fs = require('fs'), path = require('path');
  ['rentabelnost.test.js', 'rentabelnost_izm.test.js', 'rentabelnost_v2.test.js', 'dinamika.test.js'].forEach((f) => {
    const s = fs.readFileSync(path.join(__dirname, f), 'utf8');
    assert.ok(!/long_liab|short_liab/.test(s), f);
  });
});
