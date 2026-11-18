// rekvizity-kartochki-v1: текст «Скопировать реквизиты» на карточке /company/
const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/rekvizity-kartochki.js');

test('rekvizity-kartochki-v1: строки «Подпись: значение», без строки людей, источник в конце', () => {
  const t = R.tekst([
    ['ИНН', '2309085638', false],
    ['Основной вид деятельности (ОКВЭД)', '68.20.21 — Аренда', false],
    ['Руководитель и участники', 'в полной проверке →', true],
  ], 'ЕГРЮЛ · сведения на 15.11.2026');
  assert.strictEqual(t, 'ИНН: 2309085638\nОсновной вид деятельности (ОКВЭД): 68.20.21 — Аренда\nИсточник: ЕГРЮЛ, сведения на 15.11.2026 (deloskop.ru)');
});

test('rekvizity-kartochki-v1: пустые строки — пустой текст', () => {
  assert.strictEqual(R.tekst([], 'ЕГРЮЛ'), '');
  assert.strictEqual(R.tekst([['ИНН', '', false]], ''), '');
});
