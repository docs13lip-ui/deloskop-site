// og-v1: снимок обложки ссылок. Запуск из корня сайта: python3 -m http.server 8001, затем node tests/oblozhka/sdelat.js
// Пишет oblozhka.png (1200×630) в корень сайта; затем сжатие палитрой — python3 tests/oblozhka/szhat.py
// oblozhka-znak-v1: заодно ikonki/yarlyk-96.png — значок ярлыков приложения (долгое нажатие на значок): знак из favicon.svg,
// по центру масс и внутри круга 80 % (лаунчеры обрезают ярлык кругом), латунь на тёмно-синем во весь квадрат.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OSNOVA = process.argv[2] || 'http://127.0.0.1:8001';
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.goto(OSNOVA + '/tests/oblozhka/oblozhka.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: 'oblozhka.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  const zn = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'favicon.svg'), 'utf8')
    .replace('rx="24" ', '').replace('translate(13.2 13.2) scale(.78)', 'translate(13.3 14.4) scale(.76)');
  const y = await b.newPage({ viewport: { width: 96, height: 96 }, deviceScaleFactor: 1 });
  await y.setContent('<html><body style="margin:0">' + zn.replace('<svg ', '<svg width="96" height="96" ') + '</body></html>');
  await y.screenshot({ path: 'ikonki/yarlyk-96.png', clip: { x: 0, y: 0, width: 96, height: 96 } });
  await b.close();
})();
