// nebo-v1 «Живое небо» (18.10.2026): слой неба тёмной темы. nebo-v2 (19.10.2026): виньетка под текстом, галактика
// во внешней трети, созвездия по наведению/касанию, кометы и вспышки на телефоне, прокрутка и наклон, стекло карточек, кадр 3840.
// Сторож: слой отдельный (fixed, под содержимым, не ловит указатель), грузится только в тёмной теме и после load,
// уходит в светлой, неподвижен при reduce-motion/экономии, пакет по требованию, без сети и хранилищ, контраст текста над небом.
// Высота 10 страниц × 1280/390 с небом и без — Chromium при сборке комплекта (КАК_ВЫЛОЖИТЬ_nebo-v1.md).
'use strict';
require('./razvernut_sborku.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const js = chitat('js/nebo.js');
const sh = chitat('js/shapka.js');

test('слой: fixed под всем содержимым, не ловит указатель, без печати, вёрстку не трогает', () => {
  assert.match(js, /\.nebo\{position:fixed;inset:0;width:100%;height:100%;z-index:-3;pointer-events:none;/);
  assert.match(js, /cv\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(js, /@media print\{\.nebo\{display:none\}/);
  assert.doesNotMatch(js, /\.style\.(height|width|margin|padding)\s*=/, 'стили страницы не меняет');
});

test('только тёмная тема и после load; светлая — гаснет и уходит со страницы', () => {
  assert.match(sh, /if \(t !== "dark" \|\| neboZhdu\) return;/);
  assert.match(sh, /window\.addEventListener\("load", function \(\) \{ setTimeout\(gruzit, 0\); \}, \{ once: true \}\)/);
  assert.match(sh, /else window\.DlkNebo\.vykl\(\)/);
  assert.match(js, /cv\.remove\(\); if \(stil\) stil\.remove\(\);/);
  assert.match(js, /if \(d\.documentElement\.getAttribute\('data-theme'\) === 'dark'\) vkl\(\);/);
});

test('reduce-motion, экономия трафика, слабая батарея — неподвижный кадр; скрытая вкладка — пауза; самоконтроль 3 мс', () => {
  assert.match(js, /staticno = tihij = mm\('\(prefers-reduced-motion: reduce\)'\) \|\| mm\('\(prefers-reduced-data: reduce\)'\) \|\| !!\(W\.navigator && W\.navigator\.connection && W\.navigator\.connection\.saveData\)/);
  assert.match(js, /function pusk\(\) \{ if \(zhivo && !staticno && !idet && !d\.hidden\)/);
  assert.match(js, /getBattery/);
  assert.match(js, /if \(sumK \/ nK > 3 && uroven > 0\)/);
  assert.match(js, /uzko \? 700 : 1700/); // телефон — вдвое с лишним меньше звёзд
  // nebo-v2: батарея в норме не «оживляет» небо при reduce-motion (в v1 оживляла — кадры шли при reduce)
  assert.match(js, /var nado = tihij \|\| \(!b\.charging && b\.level < 0\.2\)/);
  // кометы — и на телефоне, но реже и с коротким хвостом
  assert.match(js, /sledKometa = t \+ \(uzko \? 120000 : 60000\)/);
  assert.match(js, /dh: uzko \? 90 : 150/);
});

test('пакет по требованию ≤ 25 КБ сжатых, адрес — у кнопки темы в шапке; без сети, хранилищ и библиотек', () => {
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety.nebo, ['js/nebo.js']);
  Object.values(sb.stranicy).forEach((p) => assert.ok(!p.includes('nebo'), 'небо — не тегом страницы'));
  const gz = zlib.gzipSync(fs.readFileSync(path.join(K, 'js/nebo.js'))).length;
  assert.ok(gz <= 25 * 1024, 'сжатый ' + gz);
  assert.match(chitat('partials/shapka.html'), /data-tema-knopka data-nebo-src="\/js\/b\/nebo\.[0-9a-f]{10}\.js"/);
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|import\s*\(|https?:\/\//);
});

test('созвездия — герои Делоскопа, рёбра внутри фигуры', () => {
  const m = /var FIGURY = (\[[\s\S]*?\n  \]);/.exec(js);
  const F = eval(m[1]); // eslint-disable-line no-eval
  assert.ok(F.length >= 6 && F.length <= 10, 'фигур ' + F.length);
  assert.deepStrictEqual(F.map((f) => f.t).slice(0, 6), ['kolco', 'dokument', 'pechat', 'shchit', 'set', 'lupa']);
  F.forEach((f) => f.r.forEach(([a, b]) => assert.ok(f.p[a] && f.p[b], f.t)));
});

test('контраст: второстепенный текст тёмной темы над самым светлым местом неба ≥ 4,5 : 1', () => {
  const lum = (c) => { c = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const smes = (c, k, a) => c.map((v, i) => v + (k[i] - v) * a);
  // самое светлое место фона: верх градиента #18223A + синяя туманность 0,10 + ядро галактики 0,06 (тёплое)
  assert.match(js, /#18223A/);
  assert.match(js, /\[0\.28, 0\.3, 0\.42, SINIJ, 0\.10\]/);
  assert.match(js, /TEPLO \+ ',\.06\)'/);
  let c = smes([0x18, 0x22, 0x3A], [91, 155, 255], 0.10);
  c = smes(c, [255, 217, 160], 0.06);
  const k = (lum([0xA1, 0xA1, 0xA6]) + 0.05) / (lum(c) + 0.05);
  assert.ok(k >= 4.5, 'контраст ' + k.toFixed(2));
  // звёзды — точки: ореол ближней звезды не ярче 0,14 и не шире 6 радиусов (1–2 px) — пятно меньше буквы
  assert.match(js, /cx\.globalAlpha = 0\.14 \* s\.g \* mig \* s\.m;/);
  assert.match(js, /s\.r \* 6, Y - s\.r \* 6, s\.r \* 12, s\.r \* 12\)/);
  // ядро галактики — градиент из двух точек (в v1 вторая стояла внутри комментария → ровный квадрат 0,06)
  assert.match(js, /g\.addColorStop\(0, 'rgba\(' \+ TEPLO \+ ',\.06\)'\);[^\n]*\n\s*g\.addColorStop\(1, 'rgba\(' \+ TEPLO \+ ',0\)'\);/);
});

test('nebo-v2: виньетка под колонкой текста — 60 % в центре, 0 у краёв колонки; на телефоне — по всей ширине', () => {
  assert.match(js, /kol0 = Math\.min\(1180, w - 32\)/);
  assert.match(js, /st: \[\[0, 0\], \[0\.25, 0\.5\], \[0\.5, 0\.6\], \[0\.75, 0\.5\], \[1, 0\]\]/);
  assert.match(js, /uzko \? \{ x0: 0, x1: w, st: \[\[0, 0\.35\], \[0\.5, 0\.6\], \[1, 0\.35\]\] \}/);
  // виньетка — на всех слоях: дальние (при построении), туманности и галактика (слой ¼), точки — множителем mx
  assert.match(js, /dc\.globalCompositeOperation = 'destination-out'/);
  assert.match(js, /fc\.globalCompositeOperation = 'destination-out'/);
  ['MER.push', 'BLIZ.push', 'SOZ.push'].forEach((k) => assert.match(js, new RegExp(k.replace('.', '\\.') + '\\([^\\n]*m: mx\\(')));
  assert.match(js, /sv = Math\.sin\(Math\.PI \* k\) \* mx\(hx\)/);
  assert.match(js, /\* mx\(kx\)/);
});

test('nebo-v2: ядро галактики — только во внешней трети экрана по ширине (не под текстом)', () => {
  const m = /function gxy\(ug, ww, hh\) \{ return (\[[^\n]*\]); \}/.exec(js);
  assert.ok(m, 'gxy');
  const gxy = new Function('ug', 'ww', 'hh', 'return ' + m[1]); // eslint-disable-line no-new-func
  for (const ww of [390, 768, 1280, 1920, 3840]) {
    for (let ug = 0; ug < 6.3; ug += 0.05) { const x = gxy(ug, ww, 800)[0]; assert.ok(x > ww * 2 / 3, ww + ': ' + x); }
  }
});

test('nebo-v2: созвездия проявляются рядом с курсором/пальцем за 400 мс; наклон ±4 px без системных запросов', () => {
  assert.match(js, /z\.cel = Math\.hypot\(ukaz\[0\] - z\.sx, ukaz\[1\] - z\.sy\) < z\.raz \* 2\.2/);
  assert.match(js, /z\.v \+ \(z\.cel \? 1 : -1\) \* dt \/ 400/);
  assert.match(js, /z\.do = t \+ 2500/);
  assert.match(js, /\(0\.05 \+ 0\.37 \* z\.v\)/); // в покое линии едва видны
  assert.match(js, /typeof W\.DeviceOrientationEvent\.requestPermission !== 'function'/);
  assert.match(js, /px = o\(e\.gamma \/ 30\) \* -4; py = o\(\(e\.beta - 45\) \/ 30\) \* -4;/);
  assert.doesNotMatch(js, /requestPermission\(\)/);
  // прокрутка: малые доли пути страницы, слои с переносом по кругу (пустот нет)
  assert.match(js, /sKrugom\(sloj\.daljnie, pr \* 0\.02/);
  assert.match(js, /bo = pr \* 0\.08/);
  // слушатели не мешают странице
  assert.match(js, /addEventListener\('pointerdown', [\s\S]*?\{ passive: true \}\)/);
});

test('nebo-v2: стекло карточек над небом — текст ≥ 4,5 : 1 над самым светлым местом неба', () => {
  assert.match(js, /html\[data-nebo\] \.card\{background-color:rgba\(28,28,31,\.74\);-webkit-backdrop-filter:blur\(12px\)/);
  assert.match(js, /prefers-reduced-transparency:reduce\)\{html\[data-nebo\] \.card\{background-color:#1C1C1F/);
  const lum = (c) => { c = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const smes = (c, k, a) => c.map((v, i) => v + (k[i] - v) * a);
  let nebo = smes([0x18, 0x22, 0x3A], [91, 155, 255], 0.10);
  nebo = smes(nebo, [255, 217, 160], 0.06);
  // звёзды — точки 1–2 px: размытие 12 px растирает их; с запасом — +5 % белого по всей площади (≈ 8 звёзд на каждые 12 × 12 px)
  nebo = smes(nebo, [245, 245, 242], 0.05);
  const fon = smes(nebo, [28, 28, 31], 0.74);
  const k = (lum([0xA1, 0xA1, 0xA6]) + 0.05) / (lum(fon) + 0.05);
  assert.ok(k >= 4.5, 'контраст ' + k.toFixed(2));
});

test('nebo-v2: неподвижный кадр любого размера (OG 3840, печать) — DlkNebo.kadr, без виньетки; инструмент tests/kadr_neba.js', () => {
  assert.match(js, /W\.DlkNebo = \{ vkl: vkl, vykl: vykl, kadr: kadrNa, FIGURY: FIGURY \}/);
  assert.match(js, /cx = k; sMaskoj = false;/);
  const t = chitat('tests/kadr_neba.js');
  assert.match(t, /DlkNebo\.kadr\(/);
  assert.match(t, /3840/);
});
