// znakomstvo-v3 (14.11.2026): PDF «Знакомство с Делоскопом» из tests/znakomstvo/znakomstvo.html → /znakomstvo.pdf (A4, 10 стр.).
// Запуск из корня сайта: python3 -m http.server 8001, затем node tests/znakomstvo/sdelat.js
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OSNOVA = process.argv[2] || 'http://127.0.0.1:8001';
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage();
  await pg.goto(OSNOVA + '/tests/znakomstvo/znakomstvo.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.emulateMedia({ media: 'print' });
  await pg.pdf({ path: 'znakomstvo.pdf', preferCSSPageSize: true, printBackground: true });
  await b.close();
})();
