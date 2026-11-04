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
  assert.match(gl, /<a href="#doverie">Откуда данные&nbsp;→<\/a> <a class="primer-ssylka" href="\/kak-rabotaet\/#proverka">Посмотреть пример&nbsp;→<\/a>/,
    'обе ссылки на месте');
});

test('пояснения под источниками — вторым кеглем, текст и ссылка на ЦБ не тронуты', () => {
  const k = Number((blok.match(/\.ist-ne,\.ist-zsk\{font-size:(\d+)px/) || [])[1]);
  assert.ok(k >= 14 && k <= 15, 'кегль 14–15 px — не мельче строки доверия первого экрана');
  assert.match(gl, /<p class="ist-ne" data-ne-proveryaem><b>«Не&nbsp;проверено»&nbsp;— не&nbsp;«не&nbsp;найдено»\.<\/b>/);
  assert.ok(gl.includes('href="https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/" target="_blank" rel="noopener">Проверить по&nbsp;ИНН на&nbsp;сайте Банка России'));
  assert.ok((gl.match(/<p class="ist-go"><a href="\/indeks\/">Как считаем Индекс&nbsp;→<\/a> <a href="\/tochnost\/">Отчёт точности&nbsp;→<\/a> <a href="\/o-proekte\/">Кто делает Делоскоп&nbsp;→<\/a><\/p>/) || []).length === 1);
});
