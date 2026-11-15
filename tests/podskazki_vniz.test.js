// proba-podskazki (15.11.2026): список подсказок под строкой проверки на главной открывается вниз.
// Было: строка стоит в нижней части первого экрана, под ней не хватало места — правило position-try-fallbacks:flip-block
// (css/perehod.css) переворачивало список вверх, и он закрывал заголовок; перевёрнутым он оставался и после прокрутки.
// Стало: не хватает места — страница сдвигается ровно на недостающее (строка остаётся под шапкой), список встаёт под строку;
// вверх — только когда сдвигать некуда.
// Запуск: node --test tests/podskazki_vniz.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(KOREN, 'css/perehod.css'), 'utf8');

test('расчёт сдвига: ровно недостающее, строка не уходит под шапку, лишнего движения нет', () => {
  const m = /function sdvig\(h,niz,verh\)\{[^}]*\}/.exec(G);
  assert.ok(m, 'функция sdvig на месте');
  const sdvig = vm.runInNewContext('(' + m[0] + ')');
  assert.strictEqual(sdvig(186, 425, 300), 0, 'места хватает — страница не двигается');
  assert.strictEqual(sdvig(186, 164, 558), 22, 'не хватает 22 px — сдвиг на 22 px');
  assert.strictEqual(sdvig(246, 46, 558), 200, 'обычный экран компьютера: список целиком встаёт под строку');
  assert.strictEqual(sdvig(420, 40, 120), 120, 'сдвиг не больше расстояния от строки до шапки');
  assert.strictEqual(sdvig(300, 100, -20), 0, 'строка уже под шапкой — вверх страницу не тянем');
  assert.strictEqual(sdvig(0, 100, 300), 0, 'пустой список ничего не двигает');
  assert.strictEqual(sdvig(186, 163.6, 300), 23, 'дробные координаты: сдвиг округляется вверх, иначе списку не хватит доли пикселя');
});

test('список открывается вниз: место считается при каждом показе и при прокрутке; помещается под строкой — переворот выключен', () => {
  const js = G.slice(G.indexOf('// proba-podskazki'), G.indexOf('function otkryto()'));
  assert.ok(js.length > 0, 'блок proba-podskazki стоит перед otkryto()');
  // место под строкой — до нижнего края видимой области (на телефоне клавиатура её уменьшает)
  assert.match(js, /function podStrokoj\(\)\{var vv=window\.visualViewport;return \(vv\?vv\.offsetTop\+vv\.height:innerHeight\)-form\.getBoundingClientRect\(\)\.bottom-ZAZOR\}/);
  // сдвиг — сразу, без плавной прокрутки: список не мелькает над строкой; сдвигаем только при показе, не при прокрутке посетителем
  assert.match(js, /d=dvigat\?sdvig\(h,podStrokoj\(\),verh\):0;/);
  assert.match(js, /if\(d>0\)window\.scrollBy\(\{top:d,behavior:'instant'\}\)/);
  // после сдвига место меряем заново: страница могла сдвинуться меньше, чем просили
  assert.match(js, /list\.classList\.toggle\('sugg--vniz',h>0&&h<=podStrokoj\(\)\)/);
  assert.match(js, /function otkryt\(\)\{[^\n]*mesto\(true\)\}/, 'otkryt() зовёт mesto() — при каждой перерисовке списка');
  assert.match(js, /window\.addEventListener\('scroll',function\(\)\{if\(otkryto\(\)\)mesto\(false\)\},\{passive:true\}\)/, 'прокрутка при открытом списке — пересчёт без сдвига');
  assert.match(js, /function mesto\(dvigat\)\{try\{[\s\S]*\}catch\(e\)\{\}\}/, 'ошибка расчёта не ломает строку проверки');
});

test('css: основное положение — под строкой; переворот вверх — только запасной вариант', () => {
  const pravilo = /\.check--yakor \.sugg\[popover\]\{([^}]*)\}/.exec(CSS)[1];
  assert.match(pravilo, /top:anchor\(bottom\)/, 'основное положение — от нижнего края формы');
  assert.doesNotMatch(pravilo, /bottom:anchor\(top\)|position-area:\s*(top|block-start)/, 'основное положение — не над строкой');
  assert.match(pravilo, /position-try-fallbacks:flip-block/, 'запасной вариант остаётся: если сдвигать некуда, список не обрезается');
  const vniz = CSS.indexOf('.check--yakor .sugg--vniz[popover]{position-try-fallbacks:none}');
  assert.ok(vniz > CSS.indexOf('.check--yakor .sugg[popover]{'), 'помещается под строкой — переворот выключен; правило стоит после основного');
  // без якорей (старые браузеры) — список в потоке под строкой
  assert.match(G, /\n\.sugg\{position:absolute;left:0;right:0;top:calc\(100% \+ 6px\)/);
  const m = G.match(/href="\/(css\/b\/[\w-]+\.[0-9a-f]+\.css)"/g).map((s) => s.slice(7, -1)).find((f) => /\.sugg--vniz\[popover\]\{position-try-fallbacks:none\}/.test(fs.readFileSync(path.join(KOREN, f), 'utf8')));
  assert.ok(m, 'пакет со стилями подсказок подключён на главной и пересобран (tests/sobrat_js.py)');
});
