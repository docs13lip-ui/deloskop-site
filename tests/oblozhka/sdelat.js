// og-v1: снимок обложки ссылок. Запуск из корня сайта: python3 -m http.server 8001, затем node tests/oblozhka/sdelat.js
// Пишет oblozhka.png (1200×630) в корень сайта; затем сжатие палитрой — python3 tests/oblozhka/szhat.py
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OSNOVA = process.argv[2] || 'http://127.0.0.1:8001';
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.goto(OSNOVA + '/tests/oblozhka/oblozhka.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: 'oblozhka.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await b.close();
})();
