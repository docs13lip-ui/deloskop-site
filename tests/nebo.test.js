// nebo-v1 «Живое небо» (18.10.2026): слой неба тёмной темы.
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
  assert.match(js, /staticno = mm\('\(prefers-reduced-motion: reduce\)'\) \|\| mm\('\(prefers-reduced-data: reduce\)'\) \|\| !!\(W\.navigator && W\.navigator\.connection && W\.navigator\.connection\.saveData\)/);
  assert.match(js, /function pusk\(\) \{ if \(zhivo && !staticno && !idet && !d\.hidden\)/);
  assert.match(js, /getBattery/);
  assert.match(js, /if \(sumK \/ nK > 3 && uroven > 0\)/);
  assert.match(js, /uzko \? 700 : 1700/); // телефон — вдвое с лишним меньше звёзд
  assert.match(js, /if \(!uzko\) \{\s*if \(!sledKometa\)/); // кометы — не на телефоне
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
  assert.match(js, /\(0\.14 \* s\.g \* mig\)/);
  assert.match(js, /s\.r \* 6\)/);
});
