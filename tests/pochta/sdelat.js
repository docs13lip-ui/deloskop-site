// pochta-znak-v1 (14.11.2026): снимок графики фирменной подписи писем из tests/pochta/podpis.html.
// Запуск из корня сайта: python3 -m http.server 8001, затем node tests/pochta/sdelat.js
// Пишет /pochta/*: имена и размеры прежние (подписи в почтовых программах ссылаются на эти адреса).
// Снимок в два раза крупнее → уменьшение до точного размера (резче мелкий текст). PNG — палитрой (лёгкие), прозрачные — палитра с альфой.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { execFileSync } = require('child_process');
const OSNOVA = process.argv[2] || 'http://127.0.0.1:8001';
// id → [файл, ширина, высота, прозрачный]
const NABOR = [
  ['logo', 'podpis-logo.png', 496, 111, false],
  ['banner2', 'podpis-banner-v2.jpg', 1202, 300, false],
  ['banner1', 'podpis-banner.png', 1200, 280, false],
  ['eko', 'podpis-ekosistema.png', 1200, 116, true],
  ['vizitka', 'vizitka.png', 1050, 600, false],
  ['ic-pdf', 'podpis-ic-pdf.png', 50, 48, true],
  ['ic-pochta', 'podpis-ic-pochta.png', 48, 48, true],
  ['ic-sajt', 'podpis-ic-sajt.png', 50, 48, true],
  ['ic-vizitka', 'podpis-ic-vizitka.png', 50, 48, true],
  ['ic-vk', 'podpis-ic-vk.png', 50, 48, true],
];
const UMENSHIT = [
  'import sys', 'from PIL import Image',
  'src, dst, w, h, alfa = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5] == "1"',
  'im = Image.open(src).convert("RGBA" if alfa else "RGB").resize((w, h), Image.LANCZOS)',
  'if dst.endswith(".jpg"): im.save(dst, quality=88, optimize=True, progressive=True)',
  'elif alfa: im.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(dst, optimize=True)',
  'else: im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(dst, optimize=True)',
].join('\n');
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const pg = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
  await pg.goto(OSNOVA + '/tests/pochta/podpis.html', { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  for (const [id, fajl, w, h, alfa] of NABOR) {
    const png = '/tmp/pochta-' + id + '.png';
    await pg.locator('#' + id).screenshot({ path: png, omitBackground: alfa });
    execFileSync('python3', ['-c', UMENSHIT, png, 'pochta/' + fajl, String(w), String(h), alfa ? '1' : '0']);
  }
  await b.close();
})();
