// oglavlenie-kartochki-v1: текущий раздел в оглавлении карточки /company/
const test = require('node:test');
const assert = require('node:assert');
const O = require('../js/oglavlenie-kartochki.js');

test('oglavlenie-kartochki-v1: текущий — последний раздел, чей верх выше порога', () => {
  assert.strictEqual(O.aktivnyj([300, 900, 1500], 100), -1);
  assert.strictEqual(O.aktivnyj([-200, 90, 700], 100), 1);
  assert.strictEqual(O.aktivnyj([-2000, -900, -10], 100), 2);
});

test('oglavlenie-kartochki-v1: раздела нет на странице (null) — пропускаем', () => {
  assert.strictEqual(O.aktivnyj([-500, null, 400], 100), 0);
  assert.strictEqual(O.aktivnyj([], 100), -1);
});

test('svernut-kartochki-v1: раскрыть все свёрнутые <details> вокруг элемента', () => {
  const d2 = { tagName: 'DETAILS', open: false, parentNode: { tagName: 'BODY', parentNode: null } };
  const d1 = { tagName: 'DETAILS', open: true, parentNode: d2 };
  const el = { tagName: 'DIV', parentNode: { tagName: 'UL', parentNode: d1 } };
  assert.strictEqual(O.raskryt(el), 1);
  assert.strictEqual(d2.open, true);
  assert.strictEqual(O.raskryt(el), 0);
});
