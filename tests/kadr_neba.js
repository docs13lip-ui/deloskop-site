// nebo-v2: неподвижный кадр неба любого размера — для OG (3840 × 2016) и печати; рендер Chromium.
// Не сторож и не сборка: картинки в репозиторий не кладём (вес), делаем по запросу.
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/kadr_neba.js http://127.0.0.1:8001 [ширина=3840] [высота=2016] [файл.png]
// Кадр — без виньетки под текстом и без событий (метеоры, кометы); посев тот же, что на сайте.
'use strict';
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSNOVA = 'http://127.0.0.1:8001', SH = '3840', VY = '2016', FAJL] = process.argv.slice(2);

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await c.addInitScript(() => { try { localStorage.setItem('tema', 'dark'); } catch (e) {} });
  const p = await c.newPage();
  await p.goto(OSNOVA + '/o-proekte/', { waitUntil: 'load' });
  await p.waitForFunction(() => window.DlkNebo && window.DlkNebo.kadr, null, { timeout: 15000 });
  const url = await p.evaluate(([w, h]) => window.DlkNebo.kadr(w, h).toDataURL('image/png'), [+SH, +VY]);
  const put = FAJL || 'nebo-' + SH + 'x' + VY + '.png';
  fs.writeFileSync(put, Buffer.from(url.split(',')[1], 'base64'));
  console.log('кадр: ' + put + ' (' + SH + ' × ' + VY + ')');
  await b.close();
})();
