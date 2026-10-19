// vitrina-v2b: статичный кадр сцены экспоната шириной ≈ 3840 px (для OG, печати, «до/после») — рендер Chromium.
// Не сторож и не сборка: картинки в репозиторий не кладём (вес), делаем по запросу.
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/kadr_vitriny.js http://127.0.0.1:8001 <id экспоната> [dark|light] [файл.png]
// Сцена снимается стоящей: «меньше движения» (без пылинок и поворота), курсор в центре.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSNOVA = 'http://127.0.0.1:8001', ID = 'proverka', TEMA = 'dark', FAJL] = process.argv.slice(2);
const SHIRINA = 3840;

(async () => {
  const b = await chromium.launch();
  const c0 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p0 = await c0.newPage();
  await p0.goto(OSNOVA + '/', { waitUntil: 'networkidle' });
  const w = await p0.evaluate((id) => { const s = document.querySelector('#' + id + ' .vit-e__scena'); return s ? s.getBoundingClientRect().width : 0; }, ID);
  await c0.close();
  if (!w) { console.error('нет сцены у экспоната #' + ID); process.exit(1); }
  const c = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: SHIRINA / w, colorScheme: TEMA, reducedMotion: 'reduce' });
  await c.addInitScript((t) => { try { localStorage.setItem('tema', t); } catch (e) {} }, TEMA);
  const p = await c.newPage();
  await p.goto(OSNOVA + '/', { waitUntil: 'networkidle' });
  const el = await p.$('#' + ID + ' .vit-e__scena');
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  const put = FAJL || 'vitrina-' + ID + '-' + TEMA + '-' + SHIRINA + '.png';
  await el.screenshot({ path: put });
  console.log('кадр: ' + put + ' (' + SHIRINA + ' px по ширине)');
  await b.close();
})();
