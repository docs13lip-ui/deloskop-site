// otchet-detali-v1: замер отчёта на главной (/?inn=…) — вкладки, рамки-сироты, поля касания, тексты ссылок, высота, CLS.
// Запуск: python3 -m http.server 8001 &  OTVET=ответ.json node tests/zamer_otcheta.js http://deloskop.ru:8001
// (deloskop.ru указывает на 127.0.0.1 — так страница ходит в api.deloskop.ru, а ответ /api/check подставляем из OTVET).
'use strict';
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OSNOVA = process.argv[2] || 'http://deloskop.ru:8001';
const OTVET = fs.readFileSync(process.env.OTVET, 'utf8');
const INN = (JSON.parse(OTVET).company || {}).inn || '7707083893';

function izmerit() {
  const rep = document.querySelector('.report.ot');
  if (!rep) return { net: true };
  const vid = [...rep.querySelectorAll('[role=tablist]')].map((t) => new Set([...t.querySelectorAll('[role=tab]')]
    .filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().top))).size);
  // рамка-сирота: видимая боковая рамка у блока, рядом с которым ничего нет (одна колонка)
  let siroty = 0;
  rep.querySelectorAll('.ot-ix,.ex-ix').forEach((e) => {
    const cs = getComputedStyle(e), b = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect();
    if (parseFloat(cs.borderRightWidth) > 0 && cs.borderRightStyle !== 'none' && b.right > p.right - 60) siroty++;
  });
  const lim = innerWidth < 641 ? 44 : 24, melkie = [];
  rep.querySelectorAll('a,button,summary,select,input,[role=tab]').forEach((e) => {
    if (!e.offsetParent) return;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) return;
    let h = b.height, w = b.width;
    for (const ps of ['::before', '::after']) {
      const s = getComputedStyle(e, ps);
      if (s.content !== 'none' && s.position === 'absolute') { h = Math.max(h, parseFloat(s.height) || 0); w = Math.max(w, b.width - 2 * Math.min(0, parseFloat(s.left) || 0)); }
    }
    if (h < lim || w < lim) melkie.push(e.tagName + ' «' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '» ' + Math.round(w) + '×' + Math.round(h));
  });
  const tekst = new Map();
  rep.querySelectorAll('a[href]').forEach((a) => {
    if (!a.offsetParent) return;
    const t = a.textContent.trim().replace(/\s+/g, ' '), h = a.getAttribute('href');
    if (!tekst.has(t)) tekst.set(t, new Set());
    tekst.get(t).add(h);
  });
  const dubli = [...tekst].filter(([, s]) => s.size > 1).map(([t, s]) => t + ' ×' + s.size);
  return { vid, siroty, melkie, dubli, vys: document.documentElement.scrollHeight, otchet: Math.round(rep.getBoundingClientRect().height),
    vbok: document.documentElement.scrollWidth - innerWidth };
}

(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--host-resolver-rules=MAP deloskop.ru 127.0.0.1'] });
  for (const tema of ['dark', 'light']) for (const w of [390, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: tema, hasTouch: w < 641, isMobile: w < 641 });
    await ctx.addInitScript((t) => { try { localStorage.setItem('tema', t); } catch (e) { /* без хранилища — тема по умолчанию */ } }, tema);
    await ctx.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.origin === new URL(OSNOVA).origin) return r.continue();
      const h = { 'access-control-allow-origin': new URL(OSNOVA).origin, 'access-control-allow-credentials': 'true' };
      if (u.hostname === 'api.deloskop.ru' && u.pathname === '/api/check') return r.fulfill({ status: 200, contentType: 'application/json', body: OTVET, headers: h });
      if (u.hostname === 'api.deloskop.ru') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: h });
      return r.abort();
    });
    const pg = await ctx.newPage(), osh = [];
    pg.on('pageerror', (e) => osh.push(String(e)));
    await pg.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await pg.goto(OSNOVA + '/?inn=' + INN, { waitUntil: 'load' });
    await pg.waitForTimeout(3000);
    const r = await pg.evaluate(izmerit);
    const cls = await pg.evaluate(() => window.__cls);
    const tm = await pg.evaluate(() => document.documentElement.dataset.theme || '-');
    console.log(`${w} ${tm}: вкладки (строк) ${JSON.stringify(r.vid)} · рамок-сирот ${r.siroty} · целей < ${w < 641 ? 44 : 24} — ${r.melkie.length} · один текст у разных ссылок ${r.dubli.length} · страница ${r.vys} px (отчёт ${r.otchet}) · CLS ${cls.toFixed(3)} · вбок ${r.vbok} · JS ${osh.length}`);
    if (process.env.PODROBNO) { r.melkie.forEach((x) => console.log('   ' + x)); r.dubli.forEach((x) => console.log('   ' + x)); }
    await ctx.close();
  }
  await b.close();
})();
