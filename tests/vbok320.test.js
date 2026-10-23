// vbok-320 (23.10.2026, [Ночные запуски]): на телефоне 320 px ничего не выходит за правый край.
// Замер в браузере — tests/zamer_vbok.js (не сторож; было: 7 страниц и 170 карточек шире экрана → 0).
// Здесь — то, что держит результат в исходниках.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('общий пакет: длинное слово переносится, сегмент и карточка «Индекс — в полном отчёте» сжимаются', () => {
  const css = chitat('css/detali.css');
  assert.match(css, /body\{overflow-wrap:break-word\}/);
  assert.match(css, /\.seg--fit button\{min-width:0\}/);
  assert.match(css, /@media \(max-width:640px\)\{\.co-ind--wait \.co-ind__n\{white-space:normal\}\}/);
});

test('главная: плашки «Откуда данные» с переносами, на 320 px поля меньше', () => {
  const h = chitat('index.html');
  assert.match(h, /@media \(max-width:520px\)\{\.doverie \.chip\{-webkit-hyphens:auto;hyphens:auto\}\}/);
  assert.match(h, /@media \(max-width:360px\)\{\.doverie \.chip\{padding:14px\}\}/);
});

test('поле ИНН в ряду с кнопкой сжимается (Паспорт)', () => {
  assert.match(chitat('pasport/index.html'), /\.ask input\{flex:1 1 240px;min-width:0;/);
});

test('тарифы: цена основателя и кнопка на 320 px — в две строки (источник — sobrat_tarify)', () => {
  const r = /@media \(max-width:360px\)\{\.osn-band__r\{flex-wrap:wrap;gap:12px 16px\}\.osn-band \.cta\{flex:1 1 100%\}\}/;
  assert.match(chitat('tests/sobrat_tarify.py'), r);
  assert.match(chitat('tarify/index.html'), r);
});

test('калькулятор техпоставщика: итог переносится на 320 px', () => {
  assert.match(chitat('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html'),
    /@media \(max-width:360px\)\{\.calc-st \.box\{padding:20px\}\.calc-st \.tot\{flex-wrap:wrap;gap:4px 16px;font-size:20px\}\}/);
});
