// glavnaya-9e-v1 (п. 435 Очереди, 01.11.2026) — главная на телефоне (390 px) ≤ 9 экранов без потери текста и ссылок.
// Замер в Chromium 390×844: 8 581 → 7 585 px (10,2 → 9,0 экрана); 1280 — без изменений (6 741 px).
// node --test tests/glavnaya_9e.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const gl = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const nach = gl.indexOf('/* glavnaya-9e-v1');
const blok = (() => {
  const m = gl.indexOf('@media (max-width:600px){', nach);
  let g = 0;
  for (let i = m; i < gl.length; i++) {
    if (gl[i] === '{') g++;
    if (gl[i] === '}' && --g === 0) return gl.slice(m, i + 1);
  }
  return '';
})();

test('правила телефона — одним блоком внутри @media (max-width:600px), широкий экран не задет', () => {
  assert.ok(nach > 0 && blok.length > 200, 'нет блока glavnaya-9e-v1');
  const vne = gl.slice(0, nach) + gl.slice(nach + blok.length + 200);
  ['.ex-pod{display:none}', '.vhod__go{display:none}', 'scroll-snap-type:x mandatory'].forEach((s) =>
    assert.ok(!vne.includes(s), s + ' — только на телефоне'));
});

test('текст не теряется: «В отчёте ещё…» и «Ввести ИНН →» остаются в разметке, прячется только вид на телефоне', () => {
  assert.match(gl, /<p class="ex-pod">В&nbsp;отчёте ещё:/);
  assert.ok((gl.match(/<div class="vhod__go" aria-hidden="true">/g) || []).length >= 2); // glavnaya-6-blokov-v1: два входа
  assert.match(blok, /\.vhod h3::after\{content:"\\00a0→"/, 'стрелка у заголовка входа вместо строки «Ввести ИНН →»');
});

test('разборы — лентой вбок: прокрутка внутри блока, карточка со щелчком, следующая выглядывает; страница вбок не едет', () => {
  assert.match(blok, /\.pr-gl\{display:flex;overflow-x:auto;scroll-snap-type:x mandatory/);
  assert.match(blok, /margin-inline:calc\(-1 \* var\(--pad\)\);padding:0 var\(--pad\)/, 'лента от края до края, начало — по сетке');
  const shir = Number((blok.match(/\.pr-gl a\{flex:0 0 (\d+)%/) || [])[1]);
  assert.ok(shir >= 75 && shir <= 90, 'карточка 75–90 % ширины — следующая видна');
  assert.match(blok, /\.pr-gl a\{[^}]*scroll-snap-align:start/);
  assert.ok(gl.includes('<p class="vse"><a href="/praktika/" data-praktika-gl>Все разборы'), 'ссылка «Все разборы» на месте');
});

test('номер шага «Что вы увидите в отчёте» — в строку с заголовком, абзац во всю ширину', () => {
  assert.match(blok, /\.chetyre__l li\{display:grid;grid-template-columns:auto 1fr/);
  assert.match(blok, /\.chetyre__l li>p\{grid-column:1\/-1\}/);
});
