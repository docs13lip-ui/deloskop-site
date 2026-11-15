// geroj-3d-v1 (15.11.2026): объёмный знак над заголовком главной и строка проверки как главный предмет экрана.
// Запуск: node --test tests/znak3d.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const Z = require('../js/znak3d.js');

test('kadr(): опечатка — отклонённая линза, печатают — «водит», мышь — 13 кадров поворота, средний = открыта', () => {
  assert.strictEqual(Z.kadr('zhdet', null, null), 7);
  assert.strictEqual(Z.kadr('raspoznano', null, 0.1), 7, 'распознано — линза встаёт ровно, за мышью не ходит');
  assert.strictEqual(Z.kadr('opechatka', 3, 0.9), 8);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((s) => Z.kadr('vvod', s, 0.5)), [7, 6, 7, 9, 7]);
  assert.strictEqual(Z.kadr('zhdet', null, 0), 10);
  assert.strictEqual(Z.kadr('zhdet', null, 1), 22);
  assert.strictEqual(Z.kadr('zhdet', null, 0.5), 16);
  assert.strictEqual(Z.kadr('zhdet', null, -3), 10);
  assert.strictEqual(Z.kadr('zhdet', null, 7), 22);
});

test('poziciya(): лист 6 × 4 — кадр 0 в левом верхнем углу, 23 — в правом нижнем', () => {
  assert.strictEqual(Z.KOL * Z.RYADY, 24);
  assert.strictEqual(Z.poziciya(0), '0.00% 0.00%');
  assert.strictEqual(Z.poziciya(7), '20.00% 33.33%');
  assert.strictEqual(Z.poziciya(23), '100.00% 100.00%');
});

test('главная: объёмный знак — картинка в разметке с размерами (сдвигов нет), перед заголовком, скрыт от чтения; плоский знак остаётся', () => {
  const h = chitat('index.html');
  const m = h.match(/<div class="z3" aria-hidden="true" data-z3-src="(\/js\/b\/znak3d\.[0-9a-f]{10}\.js)" data-z3-kadry="(\/img\/znak3d-kadry\.webp)"><img class="z3__k" src="(\/img\/znak3d\.webp)" width="168" height="168" alt="" decoding="async"><\/div>/);
  assert.ok(m, 'нет блока объёмного знака');
  for (const f of [m[1], m[2], m[3]]) assert.ok(fs.existsSync(path.join(KOREN, f)), 'файл на месте: ' + f);
  assert.ok(h.indexOf('class="lp"') < h.indexOf(m[0]) && h.indexOf(m[0]) < h.indexOf('<h1 class="hero-h1">'), 'после плоского знака, перед заголовком');
  assert.strictEqual((h.match(/class="z3"/g) || []).length, 1);
  const zagr = h.slice(h.indexOf(m[0]), h.indexOf('<h1 class="hero-h1">'));
  assert.match(zagr, /IntersectionObserver/);
  assert.match(zagr, /requestIdleCallback/);
  assert.doesNotMatch(zagr, /<script[^>]+src=/, 'модуль — не тегом в разметке, первому экрану не мешает');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety.znak3d, ['js/znak3d.js']);
  assert.ok(sb.stranicy['index.html'].includes('znak3d'));
  assert.ok(!sb.pakety.glavnaya.includes('js/znak3d.js'));
});

test('вес: картинка знака ≤ 16 КБ, лист кадров ≤ 200 КБ и не в разметке, модуль ≤ 2 КБ gzip', () => {
  assert.ok(fs.statSync(path.join(KOREN, 'img/znak3d.webp')).size <= 16 * 1024);
  assert.ok(fs.statSync(path.join(KOREN, 'img/znak3d-kadry.webp')).size <= 200 * 1024);
  const h = chitat('index.html');
  assert.doesNotMatch(h, /<(img|link)[^>]+znak3d-kadry/, 'лист кадров грузит модуль, а не страница');
  const adres = h.match(/\/js\/b\/znak3d\.[0-9a-f]{10}\.js/)[0];
  const gz = zlib.gzipSync(fs.readFileSync(path.join(KOREN, adres)), { level: 9 }).length;
  assert.ok(gz <= 2 * 1024, 'модуль ' + gz + ' Б gzip');
});

test('js/znak3d.js: без холста и WebGL, без сети и хранилища; «уменьшить движение» и экономия трафика — лист не грузится', () => {
  const kod = chitat('js/znak3d.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(kod, /getContext|webgl|<canvas|createElement\('canvas'\)/i);
  assert.doesNotMatch(kod, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|dlkGoal|ym\(/, 'ни текст, ни ИНН никуда не уходят');
  assert.match(kod, /prefers-reduced-motion: reduce/);
  assert.match(kod, /if \(tiho \|\| \(sv && sv\.saveData\)\) return;/);
  assert.match(kod, /\(hover: hover\) and \(pointer: fine\)/, 'поворот за указателем — только с мышью');
  assert.match(kod, /input\.setAttribute\('placeholder'/, 'примеры — подсказка поля, не его значение');
  assert.doesNotMatch(kod, /input\.value\s*=/, 'значение поля модуль не меняет');
  for (const p of Z.PRIMERY) assert.ok(!/\d{10}/.test(p) && !/!/.test(p), 'пример без настоящего ИНН и без «!»: ' + p);
  assert.strictEqual(Z.PRIMERY[0], 'ИНН, название или реквизиты', 'первый пример = подсказка из разметки');
});

test('стили: место под знак задано заранее, вне режима отчёта; плоский знак невидим, но в разметке; телефон — по центру; reduce-motion; печать', () => {
  const h = chitat('index.html');
  const css = h.slice(h.indexOf('/* geroj-3d-v1'), h.indexOf('@media print{.z3{display:none!important}}') + 45);
  assert.match(css, /\.z3\{display:none\}/, 'в режиме отчёта знака нет');
  assert.match(css, /html:not\(\.rezhim-otcheta\) \.z3\{display:block;[^}]*width:clamp\([^)]*\);aspect-ratio:1;/, 'ширина и пропорция — с первого кадра (CLS 0)');
  assert.match(css, /html:not\(\.rezhim-otcheta\) \.lp\{position:absolute;[^}]*width:1px;height:1px;[^}]*opacity:0;/, 'плоский знак остаётся в потоке событий (не display:none) — с него читается состояние');
  assert.doesNotMatch(css, /\.lp\{[^}]*display:none/);
  assert.match(css, /@media \(max-width:600px\)\{\s*html:not\(\.rezhim-otcheta\) \.hero-text\{align-items:center;text-align:center\}/, 'телефон — по центру');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.z3__k,\.z3--puls::before\{animation:none!important\}/);
  assert.match(h, /@media print\{\.z3\{display:none!important\}\}/);
  assert.match(css, /\.check:focus-within\{box-shadow:0 0 0 2px var\(--accent\)/, 'фокус строки — кант цвета темы');
});

test('телефон: строка проверки сразу под заголовком — пояснение уходит под неё, разметка не переставлена', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const b = h.slice(h.indexOf('/* telefon-ekran-v1'), h.indexOf('</style>', h.indexOf('/* telefon-ekran-v1')));
  assert.match(b, /@media \(max-width:600px\)\{[\s\S]*\.hero-text>\.check,[\s\S]*\.hero-text>\.note\{order:-1\}/);
  assert.doesNotMatch(b, /\.lead\{[^}]*order/);
  assert.match(b, /\.z3\{width:104px/);
  const tekst = h.slice(h.indexOf('<div class="hero-text">'));
  assert.ok(tekst.indexOf('class="lead"') < tekst.indexOf('class="check'), 'в разметке пояснение по-прежнему перед формой');
});

test('материалы первого экрана: тиснение кожи и рейка красного дерева — лёгкие, не в режиме отчёта и не в печати', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const n = h.indexOf('/* kabinet-v1');
  assert.ok(n > 0, 'блок kabinet-v1 на месте');
  const b = h.slice(n, h.indexOf('</style>', n));
  assert.match(b, /html:not\(\.rezhim-otcheta\) \.hero::before\{[^}]*faktura-kozha\.webp[^}]*pointer-events:none/);
  assert.match(b, /html:not\(\.rezhim-otcheta\) \.hero::after\{[^}]*faktura-derevo\.webp/);
  assert.match(b, /@media print\{\.hero::before,\.hero::after\{display:none!important\}\}/);
  const ves = (f) => fs.statSync(path.join(__dirname, '..', f)).size;
  assert.ok(ves('img/faktura-kozha.webp') < 16000, 'тиснение легче 16 КБ');
  assert.ok(ves('img/faktura-derevo.webp') < 4000, 'рейка легче 4 КБ');
});
