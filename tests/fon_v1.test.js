// fon-v1 (09.11.2026): контраст по пикселю под текстом — замер tests/zamer_fon.js (Chromium, обе темы, 1280 и 390 px).
// Здесь сторож найденного: подпись под полем ИНН на /vse-vozmozhnosti/ лежит в тени карточки поля,
// серый --muted давал там 4,2:1 — теперь цвет как у такой же строки на главной (.note — --ink2 / --ink-2).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('fon-v1: «10 проверок в день» под полем ИНН витрины — не серым по тени', () => {
  const css = chitat('css/vitrina.css');
  const m = css.match(/\.vv-inn__n\{[^}]*\}/);
  assert.ok(m, 'правило .vv-inn__n в css/vitrina.css');
  assert.match(m[0], /color:var\(--ink-2\)/, 'цвет — --ink-2 (определён в обеих темах), не --muted');
  assert.doesNotMatch(m[0], /--muted/);
});

test('fon-v1: инструмент замера на месте и смотрит пиксели, а не CSS', () => {
  const js = chitat('tests/zamer_fon.js');
  assert.match(js, /getClientRects/, 'куски текста — по прямоугольникам строк');
  assert.match(js, /color:transparent!important/, 'второй снимок — с прозрачным текстом');
  assert.match(js, /0\.03/, 'видимость — по разнице снимков (≥ 3 % пикселей)');
  assert.match(js, /Math\.floor\(ks\.length \* 0\.1\)/, 'метрика — 10-й перцентиль фона');
});
