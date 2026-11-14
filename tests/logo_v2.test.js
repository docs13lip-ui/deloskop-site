// logo-v3 (14.11.2026): знак Делоскопа — «лупа-галочка» (раскрытая лупа оценщика складывается в отметку) и слово «Делоскоп» шрифтом Unbounded.
// Сторожа: знак и слово в шапке одни на всех страницах; шрифт слова — только буквы названия, лёгкий, с лицензией рядом;
// прежних знаков (два кольца, круг-печать) в шапке и значках нет; знак — одна заливка цветом текста, без идентификаторов; значки — нужных размеров.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const ZNAK = '<svg width="32" height="32" viewBox="0 0 120 120" fill="currentColor" aria-hidden="true"><path d="M49.86 85.91A12 12 0 0 1 32.14 102.09L11.14 79.09A12 12 0 0 1 28.86 62.91ZM46.79 98.77A7.5 7.5 0 0 1 35.21 89.23L60.36 58.69A7.5 7.5 0 0 1 71.94 68.22ZM29 94a12 12 0 1 1 24 0a12 12 0 1 1 -24 0ZM54 43a29 29 0 1 1 58 0a29 29 0 1 1 -58 0ZM64 43a19 19 0 1 0 38 0a19 19 0 1 0 -38 0ZM36.6 94a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0ZM36.6 94a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0ZM36.6 94a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0Z"/></svg>';
const PUT = ZNAK.match(/ d="([^"]+)"/)[1];
const png = (f) => { const b = fs.readFileSync(path.join(KOREN, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };

test('шапка: знак «лупа-галочка» и слово «Делоскоп» — в заготовке и на страницах', () => {
  const sh = chitat('partials/shapka.html');
  assert.strictEqual(sh.split(ZNAK + '<span class="shapka__word">Делоскоп</span>').length - 1, 2, 'знак и слово — в шапке и в меню телефона');
  assert.ok(!sh.includes('M36 18.1A16 16') && !sh.includes('M41.5 60.5L53.5 72.5L79 46') && !sh.includes('>делоскоп<'), 'прежних знаков и строчного слова нет');
  assert.ok(!/<svg[^>]*>(?:(?!<\/svg>).)*\bid=/.test(sh.split('shapka__logo')[1]), 'в знаке нет идентификаторов: он стоит на странице дважды');
  for (const f of ['index.html', 'tarify/index.html', 'o-proekte/index.html', '404.html']) {
    const t = chitat(f);
    assert.ok(t.includes(ZNAK + '<span class="shapka__word">Делоскоп</span>'), f + ': новый знак');
    assert.ok(!t.includes('M36 18.1A16 16') && !t.includes('M41.5 60.5L53.5 72.5L79 46'), f + ': прежних знаков нет');
  }
});

test('стили: знак берёт цвет текста темы; слово — Unbounded с запасом на шрифт сайта', () => {
  for (const f of ['partials/shapka.css', 'css/shapka.css']) {
    const c = chitat(f);
    assert.ok(/\.shapka \.shapka__logo,\.mnav \.shapka__logo\{[^}]*color:var\(--ink\)/.test(c), f + ': цвет знака — цвет текста');
    assert.ok(!c.includes('shapka__obod'), f + ': правила прежнего знака убраны');
    assert.ok(c.includes('.shapka__word{font:700 20px/1 "Unbounded",var(--font);letter-spacing:-.015em}'), f + ': слово');
  }
});

test('шрифт слова: только буквы названия, до 3 КБ, лицензия рядом, в fonts.css — с диапазоном букв', () => {
  const b = fs.statSync(path.join(KOREN, 'fonts/unbounded-logo-700.woff2')).size;
  assert.ok(b > 600 && b <= 3072, 'fonts/unbounded-logo-700.woff2: ' + b + ' Б');
  assert.match(chitat('fonts/OFL-Unbounded.txt'), /SIL Open Font License, Version 1\.1/);
  const f = chitat('css/fonts.css');
  assert.ok(f.includes('@font-face{font-family:"Unbounded";font-style:normal;font-weight:700;font-display:swap;src:url(/fonts/unbounded-logo-700.woff2) format("woff2");unicode-range:U+0414,U+0435,U+043A-043B,U+043E-043F,U+0441}'));
  const bukvy = new Set('Делоскоп'), diap = [0x414, 0x435, 0x43A, 0x43B, 0x43E, 0x43F, 0x441];
  assert.deepStrictEqual([...bukvy].map((x) => x.codePointAt(0)).sort((a, b2) => a - b2), diap, 'диапазон — ровно буквы слова');
});

test('значки: новый знак, прежние размеры; прежних знаков нет', () => {
  const s = chitat('favicon.svg');
  assert.ok(s.includes('<rect width="120" height="120" rx="24" fill="#0D2247"/>') && s.includes(PUT) && s.includes('fill="#D9B45A"') && !s.includes('M41.5 60.5') && !s.includes('M36 18.1') && !/metadata/.test(s));
  assert.ok(s.length < 800, 'favicon.svg лёгкий: ' + s.length);
  assert.strictEqual(png('favicon-120.png'), '120x120');
  assert.strictEqual(png('apple-touch-icon.png'), '180x180');
  assert.strictEqual(png('ikonka-512.png'), '512x512');
  assert.strictEqual(png('ikonki/ikonka-192.png'), '192x192');
  assert.strictEqual(png('ikonki/maskable-192.png'), '192x192');
  assert.strictEqual(png('ikonki/maskable-512.png'), '512x512');
  const ico = fs.readFileSync(path.join(KOREN, 'favicon.ico'));
  assert.ok(ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 1 && ico.length < 20000, 'favicon.ico — значок');
});
