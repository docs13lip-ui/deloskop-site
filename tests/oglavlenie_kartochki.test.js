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
