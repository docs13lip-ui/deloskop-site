// vizual-v3.0a: воспроизводимый замер главной «до/после» в Chromium (не сторож — node --test его не запускает).
// Запуск: два локальных сервера (python3 -m http.server) — старый main и новая сборка, затем
//   node tests/zamer_glavnoj.js http://deloskop.ru:8001 http://deloskop.ru:8002 [otvet.json]
// Хост deloskop.ru направляется на 127.0.0.1 (тогда страница ходит в api.deloskop.ru — его ответы подставляет замер:
// /api/check — из otvet.json, если он дан, остальное — 404). Сеть: 16 Мбит/с, 150 мс, процессор ×4 (4G, средний телефон).
// Что меряем до события load: файлы скриптов и стилей, КБ в сети (как отдаёт сервер — без сжатия, если его нет), load, LCP;
// CLS главной за 3 с; INP-приближение — самое долгое событие при вводе ИНН и нажатии «Проверить»; текст отчёта.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const [STARYJ, NOVYJ, OTVET_F] = process.argv.slice(2);
const OTVET = OTVET_F ? fs.readFileSync(OTVET_F, 'utf8') : null;

async function zamer(b, osnova, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const p = await ctx.newPage();
  const osh = [];
  p.on('pageerror', (e) => osh.push(String(e)));
  const host = new URL(osnova).origin;
  await ctx.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.origin === host) return r.continue();
    const h = { 'access-control-allow-origin': host, 'access-control-allow-credentials': 'true' };
    if (u.hostname === 'api.deloskop.ru' && u.pathname === '/api/check' && OTVET) return r.fulfill({ status: 200, contentType: 'application/json', body: OTVET, headers: h });
    if (u.hostname === 'api.deloskop.ru') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: h });
    return r.abort();
  });
  await p.addInitScript(() => {
    window.__cls = 0; window.__inp = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__inp = Math.max(window.__inp, e.duration); })).observe({ type: 'event', durationThreshold: 16, buffered: true });
  });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 2e6, uploadThroughput: 0.9e6 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const otv = new Map(); let fajly = 0, kb = 0;
  cdp.on('Network.responseReceived', (e) => otv.set(e.requestId, e));
  cdp.on('Network.loadingFinished', (e) => { const r = otv.get(e.requestId); if (!r || new URL(r.response.url).origin !== host) return; kb += e.encodedDataLength / 1024; if (r.type === 'Script' || r.type === 'Stylesheet') fajly++; });
  const t0 = Date.now();
  await p.goto(osnova + '/', { waitUntil: 'load' });
  const load = Date.now() - t0;
  const doLoad = { fajly, kb: Math.round(kb) };
  const lcp = await p.evaluate(() => new Promise((ok) => { new PerformanceObserver((l) => { const e = l.getEntries(); ok(Math.round(e[e.length - 1].startTime)); }).observe({ type: 'largest-contentful-paint', buffered: true }); setTimeout(() => ok(-1), 1500); }));
  await p.waitForTimeout(3000);
  const cls = await p.evaluate(() => +window.__cls.toFixed(4));
  let otchet = null;
  if (OTVET) {
    await p.fill('#inn', JSON.parse(OTVET).company.inn);
    await p.click('#check button');
    await p.waitForFunction(() => /Готово/.test(document.getElementById('note').textContent), null, { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(4000);
    // число кольца Индекса докручивается, когда кольцо видно (js/zhivoj-indeks.js), — сверяем без него; само число есть в «Почему N»
    otchet = await p.evaluate(() => document.querySelector('.report').innerText.replace(/\s+/g, ' ').replace(/Индекс Делоскопа \d+ \/ 99/, 'Индекс Делоскопа · / 99'));
  }
  const inp = await p.evaluate(() => Math.round(window.__inp));
  await ctx.close();
  return { ...doLoad, load, lcp, cls, inp, osh: osh.length, otchet };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--host-resolver-rules=MAP deloskop.ru 127.0.0.1'] });
  console.log('ширина | было: файлов / КБ до load / load мс / LCP мс / CLS / INP мс | стало: … | отчёт равен');
  for (const w of [1280, 390]) {
    const a = await zamer(b, STARYJ, w), c = await zamer(b, NOVYJ, w);
    const f = (x) => [x.fajly, x.kb, x.load, x.lcp, x.cls, x.inp].join(' / ') + (x.osh ? ' · ошибок JS ' + x.osh : '');
    if (OTVET && a.otchet !== c.otchet) { let i = 0; while (a.otchet[i] === c.otchet[i]) i++; console.log('  расходится:', JSON.stringify(a.otchet.slice(i - 40, i + 60)), '≠', JSON.stringify(c.otchet.slice(i - 40, i + 60))); }
    console.log(w + ' | ' + f(a) + ' | ' + f(c) + ' | ' + (OTVET ? a.otchet === c.otchet : '—'));
  }
  await b.close();
})();
