// vizual-v3.0b: замер тёмной темы в Chromium (не сторож — node --test его не запускает).
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/zamer_temy.js http://deloskop.ru:8001 (хост deloskop.ru направляется на 127.0.0.1 — тогда отчёт ходит в API) [dark|light] [/путь ...]
// Для каждой страницы на 1280 и 390 px: тексты, у которых контраст с фактическим фоном ниже нормы
// (4,5 : 1; крупный текст — 3 : 1), и «светлые острова» — плашки со светлым фоном площадью > 2 000 px² в тёмной теме.
// OTVET=файл.json — ответ /api/check (отчёт на главной и report.html). Фон с градиентом не считаем (неизвестен) — такие тексты идут отдельной строкой «не проверено».
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSNOVA, REZHIM = 'dark', ...PUTI0] = process.argv.slice(2);
const PUTI = PUTI0.length ? PUTI0 : ['/', '/tarify/', '/pasport/', '/indeks/', '/115-fz/', '/nalogi/', '/praktika/', '/obnovleniya/', '/o-proekte/', '/report.html?inn=7707083893', '/?inn=7707083893'];

function izmerit() {
  const parse = (s) => {
    let m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = s.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const mix = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const vidim = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; if (e.hasAttribute('inert')) return false; } return true; };
  const fon = (el) => {
    const sloi = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none' && /gradient|url/.test(s.backgroundImage)) return null;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0) { sloi.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    const html = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (html && html[3] > 0) base = html;
    if (sloi.length && sloi[sloi.length - 1][3] >= 1) base = sloi.pop();
    for (let i = sloi.length - 1; i >= 0; i--) base = mix(sloi[i], base);
    return base;
  };
  const put = (el) => { const p = []; for (let e = el; e && e !== document.body && p.length < 4; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return p.join('>'); };
  const plohie = [], ne = []; let vsego = 0;
  const vid = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || vid.has(el)) continue; vid.add(el);
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName)) continue;
    if (!vidim(el)) continue;
    vsego++;
    const s = getComputedStyle(el);
    const fg = parse(s.color); const bg = fon(el);
    if (!fg) continue;
    if (!bg) { ne.push(put(el)); continue; }
    const f = fg[3] < 1 ? mix(fg, bg) : fg;
    const L1 = lum(f), L2 = lum(bg); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize), bold = +s.fontWeight >= 600;
    const norma = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
    if (k < norma) plohie.push({ k: +k.toFixed(2), put: put(el), t: n.nodeValue.trim().slice(0, 40), fg: s.color, bg: bg.map(Math.round).slice(0, 3).join(',') });
  }
  const ostrova = [];
  if (document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches) {
    for (const el of document.body.querySelectorAll('*')) {
      const c = parse(getComputedStyle(el).backgroundColor);
      if (!c || c[3] < 0.6 || lum(c) < 0.45) continue;
      const r = el.getBoundingClientRect(); if (r.width * r.height < 2000 || !vidim(el)) continue;
      ostrova.push(put(el) + ' ' + getComputedStyle(el).backgroundColor);
    }
  }
  return { vsego, plohie, ne: ne.length, neP: [...new Set(ne)].slice(0, 5), ostrova: [...new Set(ostrova)] };
}

const SV = new Map();
const OTVET = process.env.OTVET ? require('fs').readFileSync(process.env.OTVET, 'utf8') : null; // ответ /api/check для отчёта
(async () => {
  const b = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--host-resolver-rules=MAP deloskop.ru 127.0.0.1'] });
  let itogo = 0, itogoO = 0;
  for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: REZHIM === 'light' ? 'light' : 'dark', reducedMotion: 'reduce' });
    await ctx.route('**/*', (r) => {
      const u = new URL(r.request().url()); if (u.origin === new URL(OSNOVA).origin) return r.continue();
      const h = { 'access-control-allow-origin': new URL(OSNOVA).origin, 'access-control-allow-credentials': 'true' };
      if (u.hostname === 'api.deloskop.ru' && u.pathname === '/api/check' && OTVET) return r.fulfill({ status: 200, contentType: 'application/json', body: OTVET, headers: h });
      if (u.hostname === 'api.deloskop.ru') return r.fulfill({ status: 404, contentType: 'application/json', body: '{}', headers: h });
      return r.abort();
    });
    for (const p of PUTI) {
      const pg = await ctx.newPage(); const osh = [];
      pg.on('pageerror', (e) => osh.push(String(e)));
      await pg.goto(OSNOVA + p, { waitUntil: 'load' }); await pg.waitForTimeout(400);
      await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } scrollTo(0, 0); });
      const r = await pg.evaluate(izmerit);
      itogo += r.plohie.length; itogoO += r.ostrova.length;
      console.log(`${w} ${p} тема=${await pg.evaluate(() => document.documentElement.dataset.theme || '-')} текстов ${r.vsego} · ниже нормы ${r.plohie.length} · островов ${r.ostrova.length} · не проверено ${r.ne}${osh.length ? ' · JS ' + osh.length : ''}`);
      if (process.env.SVODKA) { r.plohie.forEach((x) => { const k = x.put.split('>').slice(-2).join('>') + ' | ' + x.fg + ' на ' + x.bg; SV.set(k, (SV.get(k) || 0) + 1); }); r.ostrova.forEach((x) => { const k = 'ОСТРОВ ' + x.split('>').slice(-2).join('>'); SV.set(k, (SV.get(k) || 0) + 1); }); }
      if (process.env.PODROBNO) { r.plohie.slice(0, +process.env.PODROBNO).forEach((x) => console.log('   ', x.k, x.put, '|', x.t, '|', x.fg, 'на', x.bg)); r.ostrova.slice(0, +process.env.PODROBNO).forEach((x) => console.log('   остров', x)); }
      await pg.close();
    }
    await ctx.close();
  }
  if (process.env.SVODKA) [...SV].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v, k));
  console.log(`ИТОГО ниже нормы ${itogo}, островов ${itogoO}`);
  await b.close();
})();
