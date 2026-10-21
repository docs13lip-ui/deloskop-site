// bez-pryzhka-v1: CLS проверки ИНН на главной (ввод → «Проверить» → отчёт) и источники сдвигов.
// Запуск: python3 -m http.server 8001 &  OTVET=ответ.json [SHIR=390,1280] [TEMY=dark,light] [PODROBNO=1] node tests/zamer_proverki.js http://deloskop.ru:8001
// (deloskop.ru → 127.0.0.1, ответ /api/check подставляем из OTVET с задержкой ZADERZHKA мс, по умолчанию 800).
'use strict';
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OSNOVA = process.argv[2] || 'http://deloskop.ru:8001';
const OTVET = fs.readFileSync(process.env.OTVET, 'utf8');
const SHIR = (process.env.SHIR || '390,1280').split(',').map(Number);
const TEMY = (process.env.TEMY || 'dark').split(',');
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--host-resolver-rules=MAP deloskop.ru 127.0.0.1'] });
  for (const tema of TEMY) for (const w of SHIR) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 641 ? 844 : 900 }, colorScheme: tema, hasTouch: w < 641, isMobile: w < 641, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('tema', t); } catch (e) { /* без хранилища — тема по умолчанию */ } }, tema);
    await ctx.route('**/*', async (r) => {
      const u = new URL(r.request().url());
      if (u.origin === new URL(OSNOVA).origin) return r.continue();
      const h = { 'access-control-allow-origin': new URL(OSNOVA).origin, 'access-control-allow-credentials': 'true' };
      if (u.hostname === 'api.deloskop.ru' && u.pathname === '/api/check') { await new Promise((z) => setTimeout(z, +(process.env.ZADERZHKA || 800))); return r.fulfill({ status: 200, contentType: 'application/json', body: OTVET, headers: h }); }
      if (u.hostname === 'api.deloskop.ru') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: h });
      return r.abort();
    });
    const pg = await ctx.newPage(), osh = [];
    pg.on('pageerror', (e) => osh.push(String(e)));
    await pg.goto(OSNOVA + '/', { waitUntil: 'load' });
    await pg.waitForTimeout(1500);
    await pg.evaluate(() => {
      window.__ls = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) {
        window.__ls.push({ v: e.value, inp: e.hadRecentInput, t: Math.round(e.startTime), src: (e.sources || []).map((s) => {
          const n = s.node; let d = n ? (n.nodeType === 1 ? n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : '') : '#text:' + (n.textContent || '').trim().slice(0, 30)) : '?';
          return d + " " + JSON.stringify([s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height, "→", s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map((v) => typeof v === "number" ? Math.round(v) : v));
        }) });
      } }).observe({ type: 'layout-shift', buffered: false });
    });
    await pg.fill('#inn', '7707083893');
    await pg.waitForTimeout(300);
    await pg.click('#check button[type=submit], #check button');
    await pg.waitForSelector('.report', { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(3500);
    const ls = await pg.evaluate(() => window.__ls);
    const sum = ls.filter((x) => !x.inp).reduce((a, x) => a + x.v, 0);
    console.log(`${tema} ${w}: CLS(без ввода) ${sum.toFixed(4)}; записей ${ls.length}; JS ${osh.length}`);
    if (process.env.PODROBNO) for (const x of ls) console.log('  ', x.t, x.v.toFixed(4), x.inp ? 'ввод' : '', '\n     ' + x.src.join('\n     '));
    await ctx.close();
  }
  await b.close();
})();
