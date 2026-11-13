// logo-v2 (14.11.2026): новый знак Делоскопа — круг-печать с галочкой и слово «Делоскоп» шрифтом Unbounded.
// Сторожа: знак и слово в шапке одни на всех страницах; шрифт слова — только буквы названия, лёгкий, с лицензией рядом;
// старого знака (два кольца) в шапке и значках нет; значки — нужных размеров.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const ZNAK = '<svg width="32" height="32" viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle class="shapka__obod" cx="60" cy="60" r="51" stroke="#1D1D1F" stroke-width="10"/><circle cx="60" cy="60" r="38" fill="#0B63E5"/><path d="M41.5 60.5L53.5 72.5L79 46" stroke="#FFFFFF" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const png = (f) => { const b = fs.readFileSync(path.join(KOREN, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };

test('шапка: знак-печать и слово «Делоскоп» — в заготовке и на страницах', () => {
  const sh = chitat('partials/shapka.html');
  assert.strictEqual(sh.split(ZNAK + '<span class="shapka__word">Делоскоп</span>').length - 1, 2, 'знак и слово — в шапке и в меню телефона');
  assert.ok(!sh.includes('M36 18.1A16 16') && !sh.includes('>делоскоп<'), 'старого знака и строчного слова нет');
  for (const f of ['index.html', 'tarify/index.html', 'o-proekte/index.html', '404.html']) {
    const t = chitat(f);
    assert.ok(t.includes(ZNAK + '<span class="shapka__word">Делоскоп</span>'), f + ': новый знак');
    assert.ok(!t.includes('M36 18.1A16 16'), f + ': старого знака нет');
  }
});

test('стили: обод знака берёт цвет текста темы; слово — Unbounded с запасом на шрифт сайта', () => {
  for (const f of ['partials/shapka.css', 'css/shapka.css']) {
    const c = chitat(f);
    assert.ok(c.includes('.shapka__logo .shapka__obod{stroke:var(--ink)}'), f + ': обод');
    assert.ok(!c.includes('.shapka__logo circle{'), f + ': синий круг знака не обводится цветом текста');
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

test('значки: новый знак, прежние размеры; старых колец нет', () => {
  const s = chitat('favicon.svg');
  assert.ok(s.includes('<rect width="72" height="72" rx="14" fill="#0B63E5"/>') && s.includes('M41.5 60.5L53.5 72.5L79 46') && !s.includes('M36 18.1') && !/metadata/.test(s));
  assert.ok(s.length < 700, 'favicon.svg лёгкий: ' + s.length);
  assert.strictEqual(png('favicon-120.png'), '120x120');
  assert.strictEqual(png('apple-touch-icon.png'), '180x180');
  assert.strictEqual(png('ikonka-512.png'), '512x512');
  assert.strictEqual(png('ikonki/ikonka-192.png'), '192x192');
  assert.strictEqual(png('ikonki/maskable-192.png'), '192x192');
  assert.strictEqual(png('ikonki/maskable-512.png'), '512x512');
  const ico = fs.readFileSync(path.join(KOREN, 'favicon.ico'));
  assert.ok(ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) >= 1 && ico.length < 20000, 'favicon.ico — значок');
});
