// «Как посчитали» у крупных компаний: от 1 млрд ₽ — словами (млрд / трлн), предел аванса — точной суммой.
// Находка 02.10: у Газпрома было «8 600 000 000 000 ₽ ÷ 26 = 330 769 230 769 ₽» — на 390 px не читается.
// Запуск: node --test tests/krupnye_summy.test.js
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');

const bezNb = (s) => s.replace(/ /g, ' ');
const sig = (title, status, detail) => ({ title, status, detail: detail || '' });
const resp = (o) => Object.assign({ checked_at: '2026-10-02T10:00:00+03:00', risk_level: 'low',
  company: { inn: '7736050003', name_short: 'ПАО «Тест»', status: 'ACTIVE', reg_date: '1993-02-17' }, signals: [] }, o || {});

test('moneyKrupno: до 1 млрд — как раньше, точной суммой', () => {
  assert.strictEqual(bezNb(U.moneyKrupno(13000000)), '13 000 000 ₽');
  assert.strictEqual(bezNb(U.moneyKrupno(999999999)), '999 999 999 ₽');
  assert.strictEqual(bezNb(U.moneyKrupno(0)), '0 ₽');
});

test('moneyKrupno: млрд и трлн, запятая, без нулей в хвосте, неразрывные пробелы', () => {
  assert.strictEqual(U.moneyKrupno(8.6e12), '8,6 трлн ₽');
  assert.strictEqual(U.moneyKrupno(330769230769), '330,8 млрд ₽');
  assert.strictEqual(U.moneyKrupno(1e9), '1 млрд ₽');
  assert.strictEqual(U.moneyKrupno(2.345e9), '2,35 млрд ₽');
  assert.strictEqual(U.moneyKrupno(45.67e9), '45,7 млрд ₽');
  assert.strictEqual(U.moneyKrupno(1.2e12), '1,2 трлн ₽');
});

test('крупная компания: формула словами, предел аванса — точной суммой', () => {
  const v = U.decide(resp({ dossier: { kpi: [{ label: 'Выручка за 2025', value: 8.6e12 }] } }));
  assert.strictEqual(v.tone, 'go');
  assert.strictEqual(bezNb(v.kak.kak), 'Как посчитали: выручка за 2025 — 8,6 трлн ₽ ÷ 26 = 330,8 млрд ₽ (две недели выручки), округлили вниз.');
  assert.ok(!/\d{4,} /.test(bezNb(v.kak.kak).replace(/за \d{4}/, '')), 'в формуле нет длинных чисел');
  assert.strictEqual(v.cap, 330769000000);
});

test('крупная компания с замечанием: половина — точной суммой', () => {
  const v = U.decide(resp({ dossier: { kpi: [{ label: 'Выручка за 2025', value: 52e9 }] }, signals: [sig('Административные правонарушения', 'warn', 'штраф')] }));
  assert.strictEqual(bezNb(v.kak.kak), 'Как посчитали: выручка за 2025 — 52 млрд ₽ ÷ 26 = 2 млрд ₽ (две недели выручки) · есть 1 замечание → половина: 1 000 000 000 ₽, округлили вниз.');
});
