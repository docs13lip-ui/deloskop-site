// detali-v1: замер «глубины в каждой детали» в Chromium (не сторож — node --test его не запускает).
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/zamer_detali.js http://127.0.0.1:8001 [dark|light] [/путь ...]
// Для каждой страницы на 1280 и 390 px: разные размеры шрифта видимого текста, разные радиусы скругления,
// цели касания меньше 44 px (кнопки, вкладки, поля, ссылки вне строки текста; ссылки внутри абзаца — не считаем, WCAG 2.5.8),
// самая длинная строка абзаца (знаков), висячие короткие слова в конце строки, шрифт меньше 12 px, пропуск уровня заголовка, CLS, ошибки JS.
// ПОДРОБНО=1 — показать, какие элементы дают каждое значение.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSNOVA = 'http://127.0.0.1:8001', REZHIM = 'dark', ...PUTI0] = process.argv.slice(2);
const PUTI = PUTI0.length ? PUTI0 : ['/', '/tarify/', '/pasport/', '/indeks/', '/tochnost/', '/praktika/',
  '/115-fz/zablokirovali-schet-chto-delat/', '/reyting/', '/o-proekte/', '/zhurnal/', '/obnovleniya/', '/skoraya-115-fz/'];
const PODROBNO = !!process.env.PODROBNO;

function izmerit(norma) {
  const vidim = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      if (e.hasAttribute('inert') || e.hidden) return false;
      if (e.classList && (e.classList.contains('vh') || e.classList.contains('sr-only'))) return false;
    }
    if (r.right < 0 || r.bottom < -2000 || r.left > innerWidth) return false;  // за краем экрана (ссылка «Перейти к содержанию»)
    return true;
  };
  const imya = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const vGrafike = (el) => !!el.closest('svg, canvas, [data-grafik], .grafik');
  const razmery = new Map(), radiusy = new Map(), melkie = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vidno = new Set();
  for (let n; (n = w.nextNode());) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || vidno.has(el)) continue; vidno.add(el);
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(el.tagName)) continue;
    if (!vidim(el)) continue;
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 100) / 100;
    if (!razmery.has(px)) razmery.set(px, []);
    razmery.get(px).push(imya(el));
    if (px < 12 && !vGrafike(el)) melkie.push(imya(el) + ' ' + px);
    if (px < 12 && el.closest('svg') && px < 11.99) melkie.push('svg ' + imya(el) + ' ' + px);
  }
  for (const el of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    const r = s.borderTopLeftRadius;
    if (!r || r === '0px') continue;
    if (!vidim(el)) continue;
    const rect = el.getBoundingClientRect();
    let v = r;
    if (r.endsWith('%')) v = r; else {
      const px = parseFloat(r);
      // скругление больше половины стороны = «таблетка»/круг — одно значение
      v = px * 2 >= Math.min(rect.width, rect.height) - 0.5 ? (Math.abs(rect.width - rect.height) < 1 ? 'круг' : 'таблетка') : Math.round(px * 10) / 10 + 'px';
    }
    if (!radiusy.has(v)) radiusy.set(v, []);
    radiusy.get(v).push(imya(el));
  }
  // цели касания
  const malye = [];
  const tseli = document.body.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], label');
  for (const el of tseli) {
    if (!vidim(el)) continue;
    if (el.tagName === 'LABEL' && !el.querySelector('input')) continue;
    if (el.tagName === 'A') {
      // ссылка внутри строки текста — исключение WCAG 2.5.8
      const p = el.parentElement;
      const vStroke = p && /^(P|LI|SPAN|EM|STRONG|B|TD|DD|FIGCAPTION|SMALL|BLOCKQUOTE|H[1-6])$/.test(p.tagName) && (p.textContent.trim().length > el.textContent.trim().length + 15);
      if (vStroke) continue;
    }
    let r = el.getBoundingClientRect();
    if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type)) {
      const l = el.closest('label'); if (l) r = l.getBoundingClientRect();
    }
    const h = Math.round(r.height), ww = Math.round(r.width);
    if (h < norma || ww < 24) malye.push(imya(el) + ' ' + ww + '×' + h + ' «' + (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 24) + '»');
  }
  // длина строки
  let dlinnaya = 0; const dlinnye = [];
  for (const el of document.body.querySelectorAll('p, li, dd, figcaption, blockquote, p.pod, div.pod, p.cap, div.cap, p.disc, div.disc, .co-src')) {
    if (!vidim(el) || el.closest('nav, header, footer, table')) continue;
    const s = getComputedStyle(el);
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5;
    const h = el.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom);
    const strok = Math.round(h / lh);
    if (strok < 3) continue;
    const zn = el.textContent.replace(/\s+/g, ' ').trim().length / strok;
    if (zn > dlinnaya) dlinnaya = zn;
    if (zn > 75) dlinnye.push(imya(el) + ' ' + Math.round(zn));
  }
  // висячие короткие слова (в конце строки)
  const KOROTKIE = /^(в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об|во|мы|вы|он|её|их|ее)$/i;
  const visyat = [];
  for (const el of document.body.querySelectorAll('p, li, h1, h2, h3, h4, dd, figcaption, .pod, .cap')) {
    if (!vidim(el)) continue;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const slova = [];
    for (let t; (t = tw.nextNode());) {
      if (t.parentElement.closest('script,style')) continue;
      const re = /[^\s ]+/g; let m;
      while ((m = re.exec(t.nodeValue))) {
        const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length);
        const rs = rg.getClientRects(); if (!rs.length) continue;
        slova.push({ s: m[0], top: rs[rs.length - 1].top, nbsp: t.nodeValue[m.index + m[0].length] === ' ' });
      }
    }
    for (let i = 0; i < slova.length - 1; i++) {
      if (slova[i + 1].top - slova[i].top > 4 && KOROTKIE.test(slova[i].s.replace(/[«(]/g, ''))) visyat.push(imya(el) + ' «…' + slova[i].s + '|' + slova[i + 1].s + '»');
    }
  }
  // уровни заголовков
  const propuski = []; let pred = 0;
  for (const h of document.body.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    if (!vidim(h)) continue;
    const u = +h.tagName[1];
    if (pred && u > pred + 1) propuski.push('h' + pred + '→h' + u + ' «' + h.textContent.trim().slice(0, 30) + '»');
    pred = u;
  }
  return {
    razmery: [...razmery.keys()].sort((a, b) => a - b), razmeryKto: Object.fromEntries([...razmery].map(([k, v]) => [k, [...new Set(v)].slice(0, 4)])),
    radiusy: [...radiusy.keys()], radiusyKto: Object.fromEntries([...radiusy].map(([k, v]) => [k, [...new Set(v)].slice(0, 4)])),
    malye, dlinnaya: Math.round(dlinnaya), dlinnye, visyat, melkie: [...new Set(melkie)], propuski,
  };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const vsego = { razmery: new Set(), radiusy: new Set(), malye: 0, visyat: 0, melkie: 0, propuski: 0, dlinnaya: 0, js: 0, cls: 0 };
  for (const put of PUTI) {
    for (const shir of [1280, 390]) {
      const ctx = await b.newContext({ viewport: { width: shir, height: 900 }, colorScheme: REZHIM === 'light' ? 'light' : 'dark', deviceScaleFactor: 1 });
      await ctx.addInitScript((rezhim) => {
        try { localStorage.setItem('tema', rezhim); localStorage.setItem('dlk_cookies', '1'); } catch (e) {}
        window.__cls = 0;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
      }, REZHIM);
      const p = await ctx.newPage();
      const oshibki = [];
      p.on('pageerror', (e) => oshibki.push(String(e.message).slice(0, 80)));
      await p.route(/mc\.yandex|api\.deloskop\.ru/, (r) => r.abort());
      await p.goto(OSNOVA + put, { waitUntil: 'load' });
      await p.waitForTimeout(700);
      await p.addStyleTag({ content: '#cookie,.cookie,[data-cookie]{display:none!important}' });
      const r = await p.evaluate(izmerit, shir < 700 ? 44 : 24);  // телефон — 44 px (HIG); мышь — 24 px (WCAG 2.5.8)
      const cls = await p.evaluate(() => window.__cls);
      r.razmery.forEach((x) => vsego.razmery.add(x)); r.radiusy.forEach((x) => vsego.radiusy.add(x));
      vsego.malye += r.malye.length; vsego.visyat += r.visyat.length; vsego.melkie += r.melkie.length; vsego.propuski += r.propuski.length;
      vsego.dlinnaya = Math.max(vsego.dlinnaya, r.dlinnaya); vsego.js += oshibki.length; vsego.cls = Math.max(vsego.cls, cls);
      console.log(`${put} ${shir}: шрифтов ${r.razmery.length} · радиусов ${r.radiusy.length} · касание ${r.malye.length} · строка ${r.dlinnaya} · висячих ${r.visyat.length} · <12px ${r.melkie.length} · пропуск h ${r.propuski.length} · CLS ${cls.toFixed(3)} · JS ${oshibki.length}`);
      if (PODROBNO) {
        console.log('  шрифты', JSON.stringify(r.razmeryKto));
        console.log('  радиусы', JSON.stringify(r.radiusyKto));
        r.malye.forEach((x) => console.log('  касание', x));
        r.dlinnye.forEach((x) => console.log('  строка', x));
        r.visyat.forEach((x) => console.log('  висит', x));
        r.melkie.forEach((x) => console.log('  мелко', x));
        r.propuski.forEach((x) => console.log('  заголовок', x));
        oshibki.forEach((x) => console.log('  JS', x));
      }
      await ctx.close();
    }
  }
  console.log(`ИТОГО: размеров шрифта ${vsego.razmery.size} [${[...vsego.razmery].sort((a, b) => a - b).join(', ')}] · радиусов ${vsego.radiusy.size} [${[...vsego.radiusy].join(', ')}] · касание (390 <44, 1280 <24) ${vsego.malye} · самая длинная строка ${vsego.dlinnaya} · висячих ${vsego.visyat} · <12px ${vsego.melkie} · пропусков h ${vsego.propuski} · CLS max ${vsego.cls.toFixed(3)} · JS ${vsego.js}`);
  await b.close();
})();
