// glavnaya-9e-v2 (п. 435 Очереди, 04.11.2026) — запас под 9 экранов на 390 px и ровный левый край строки доверия.
// Замер в Chromium 390×844 (стек 24098e1a): 7 601 → 7 504 px (9,01 → 8,89 экрана); 1280 — без изменений (6 741 px).
// node --test tests/glavnaya_9e_v2.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const gl = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const nach = gl.indexOf('/* glavnaya-9e-v2');
const blok = (() => {
  const m = gl.indexOf('@media (max-width:600px){', nach);
  let g = 0;
  for (let i = m; i < gl.length; i++) {
    if (gl[i] === '{') g++;
    if (gl[i] === '}' && --g === 0) return gl.slice(m, i + 1);
  }
  return '';
})();

test('правила — одним блоком только для телефона, сразу после glavnaya-9e-v1', () => {
  assert.ok(nach > gl.indexOf('/* glavnaya-9e-v1') && blok.length > 80, 'нет блока glavnaya-9e-v2 после v1');
  const vne = gl.slice(0, nach) + gl.slice(nach + blok.length + 400);
  assert.ok(!vne.includes('.doverie-str .primer-ssylka{display:block'), 'своя строка у «Посмотреть пример» — только на телефоне');
});

test('«Посмотреть пример →» на телефоне — своей строкой без левого отступа (на переносе не висит в начале строки)', () => {
  assert.match(blok, /\.doverie-str \.primer-ssylka\{display:block;margin:4px 0 0\}/);
  // bez-otkuda-v1 (13.11): ссылки «Откуда данные →» в строке доверия нет — остался только пример
  assert.match(gl, /источник и&nbsp;дата\. <a class="primer-ssylka" href="\/kak-rabotaet\/#proverka">Посмотреть пример&nbsp;→<\/a>/, 'ссылка на пример на месте');
  assert.ok(!gl.includes('href="#doverie"'), 'ссылки на раздел об источниках нет');
});

