// peremennye-v1 (09.11.2026): CSS-переменная, которой на странице нет, — тихая поломка:
// var(--x) без запасного значения делает свойство недействительным, и браузер молча берёт
// «по умолчанию» (цвет родителя, нулевой отступ, острые углы, переход без плавности).
// Замер tests/zamer_peremennye.js (Chromium, 94 страницы × обе темы) нашёл 4 страницы:
//  /vse-vozmozhnosti/ — --ink2 (светлая: подписи витрины чёрные вместо серых) и --sect (отступы разделов — 0);
//  /nalogi/kalkulyator-tehnicheskij-postavshchik/ — --r-lg/--r-md (углы карточек острые),
//    --ok/--ok-bg (светлая: зелёной плашки «Сейчас проверка бесплатна» нет);
//  главная — --ease (кнопки витрины и отзыва без плавного перехода).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('peremennye-v1: витрина зовёт --ink-2 (есть в обеих темах), а не --ink2 (только в тёмной)', () => {
  const css = chitat('css/vitrina.css');
  assert.doesNotMatch(css, /var\(--ink2\)/);
  assert.ok((css.match(/var\(--ink-2\)/g) || []).length >= 6);
});

test('peremennye-v1: на /vse-vozmozhnosti/ задан --sect — как на главной (и 44 px на телефоне)', () => {
  const h = chitat('vse-vozmozhnosti/index.html');
  assert.match(h, /\.vv\{--sect:clamp\(64px,9vw,112px\)\}/);
  assert.match(h, /@media \(max-width:600px\)\{\.vv\{--sect:44px\}\}/);
});

test('peremennye-v1: калькулятор «технического» поставщика — свои --r-lg, --r-md, --ok, --ok-bg', () => {
  const h = chitat('nalogi/kalkulyator-tehnicheskij-postavshchik/index.html');
  const root = h.match(/:root\{--bg:#F5F5F2;[^}]*\}/);
  assert.ok(root, ':root страницы');
  for (const v of ['--r-lg:28px', '--r-md:16px', '--ok:#16723F', '--ok-bg:#E8F5EE']) assert.ok(root[0].includes(v), v);
});

test('peremennye-v1: на главной есть --ease для переходов кнопок', () => {
  const h = chitat('index.html');
  assert.match(h, /--ease:cubic-bezier\(\.2,\.7,\.2,1\)/);
});

test('peremennye-v1: инструмент замера на месте и разбирает запасные значения', () => {
  const js = chitat('tests/zamer_peremennye.js');
  assert.match(js, /cssText/, 'читает cssText — чтобы видеть сокращения (background, padding-block)');
  assert.match(js, /nuzhny\(vnutri\.slice\(z \+ 1\)/, 'запас смотрится, только если основной переменной нет');
});
