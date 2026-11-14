// dokumenty-znak-v1 (14.11.2026): снимок визитки для листов админки (js/admin-dokumenty.js — «визитка» в углу листа).
// Запуск из корня сайта: python3 -m http.server 8001, затем node tests/dok/sdelat.js
// Пишет img/dok/vizitka-lico.jpg и img/dok/vizitka-oborot.jpg: 540×300 снимок в два раза крупнее → уменьшение (резче мелкий текст),
// JPEG 88 — каждая ≤ 40 КБ (сторож в tests/admin_dokumenty.test.js).
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { execFileSync } = require('child_process');
const OSNOVA = process.argv[2] || 'http://127.0.0.1:8001';
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 540, height: 600 }, deviceScaleFactor: 2 });
  await pg.goto(OSNOVA + '/tests/dok/vizitka.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  for (const id of ['lico', 'oborot']) {
    const png = '/tmp/vizitka-' + id + '.png';
    await pg.locator('#' + id).screenshot({ path: png });
    execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGB").resize((540, 300), Image.LANCZOS).save(sys.argv[2], quality=88, optimize=True, progressive=True)', png, 'img/dok/vizitka-' + id + '.jpg']);
  }
  await b.close();
})();
