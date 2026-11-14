// muted-v1 (09.11.2026): серый «вторичного» текста --muted #6B6B70 → #5B6783 (светлая тема).
// Замер tests/zamer_fon.js (Chromium, светлая, 1280 — все 94 страницы sitemap + карточки /company/):
// под текстом лежит не ровный #F5F1E6, а фон страницы — body::before (два мягких пятна) и body::after (зерно 3,5 %).
// По пикселям серый #6B6B70 давал 4,24–4,49:1 (норма WCAG 4,5): подписи /tarify/ и /indeks/, крошки «›» на всех страницах,
// шаги /kak-rabotaet/. #5B6783 на самом тёмном замеренном пикселе фона — 4,57:1, на ровном #F5F1E6 — 5,23:1.
// Глазом разница не видна (ΔL ≈ 1,5), тёмная тема не тронута (свой --muted).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');

function vse(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) vse(p, out);
    else if (/\.(html|css|js|py)$/.test(e.name)) out.push(p);
  }
  return out;
}

function lum(h) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(parseInt(h.slice(0, 2), 16)) + 0.7152 * f(parseInt(h.slice(2, 4), 16)) + 0.0722 * f(parseInt(h.slice(4, 6), 16));
}
const k = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('muted-v1: старого серого #6B6B70 в CSS сайта нет', () => {
  const ostalos = [];
  for (const f of vse(KOREN)) {
    if (f.endsWith(path.join('tests', 'muted_v1.test.js'))) continue;
    const t = fs.readFileSync(f, 'utf8');
    // w:color — цвет в Word-шаблоне письма (белый лист, 5,3:1), это не CSS
    const bez = t.replace(/w:val="6B6B70"/g, '');
    if (/#6B6B70/i.test(bez)) ostalos.push(path.relative(KOREN, f));
  }
  assert.deepStrictEqual(ostalos, [], 'везде #5B6783');
});

test('muted-v1: --muted в светлой теме — #5B6783, и он держит 4,5:1 даже на самом тёмном зерне фона', () => {
  const html = fs.readFileSync(path.join(KOREN, 'tarify', 'index.html'), 'utf8');
  assert.match(html, /--muted:#5B6783/);
  assert.ok(k('66666B', 'F5F5F2') >= 5.2, 'на ровном фоне страницы');
  // самый тёмный пиксель фона под текстом по замеру 09.11 — яркость 0,79 (≈ #E7E7E4)
  assert.ok((0.79 + 0.05) / (lum('66666B') + 0.05) >= 4.5, 'на зерне и пятнах body::before/::after');
  assert.ok((0.79 + 0.05) / (lum('6B6B70') + 0.05) < 4.5, 'старый серый там не держал');
});
