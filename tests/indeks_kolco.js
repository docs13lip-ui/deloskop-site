// Сторож с живого (не в CI — нужен API): Индекс в кольце отчёта = индекс из ответа, «Почему N›» = числу в кольце.
// 390/1280 × тёмная/светлая × два пути (/?inn= и ввод ИНН + Enter), через 3 с после появления отчёта.
// Запуск: node tests/indeks_kolco.js [https://deloskop.ru] [ИНН]. Код выхода 1 — расхождение.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'https://deloskop.ru', INN = process.argv[3] || '7707083893';
(async () => {
  const fs = require('fs'), exe = '/opt/pw-browsers/chromium';
  const b = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  let plohо = 0;
  for (const w of [390, 1280]) for (const sch of ['dark', 'light']) for (const put of ['url', 'vvod']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 850 }, colorScheme: sch });
    const p = await ctx.newPage();
    if (put === 'url') await p.goto(BASE + '/?inn=' + INN, { waitUntil: 'load' });
    else { await p.goto(BASE + '/', { waitUntil: 'load' }); await p.fill('input[name=inn]', INN); await p.keyboard.press('Enter'); }
    await p.waitForSelector('.ot-ix .ot-ix__big', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(3000);
    const r = await p.evaluate(() => {
      const big = document.querySelector('.ot-ix .ot-ix__big'), m = document.body.innerText.match(/Почему\s*(\d+)/);
      return { kolco: big ? parseInt(big.textContent, 10) : null, pochemu: m ? +m[1] : null };
    });
    const ok = r.kolco >= 1 && r.kolco <= 99 && (r.pochemu == null || r.pochemu === r.kolco);
    if (!ok) plohо++;
    console.log((ok ? '✓' : '✗'), w, sch, put, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
  process.exit(plohо ? 1 : 0);
})();
