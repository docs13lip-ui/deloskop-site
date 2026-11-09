// fon-v1: замер контраста «пиксель под текстом» — для текста на градиентах, небе, тенях и картинках,
// где цвет фона из CSS не равен тому, что видит глаз. Не сторож и не сборка: инструмент по запросу.
// Как: страница в Chromium; движение — сразу в конечное состояние; страница прокручивается до конца
// (появления по прокрутке срабатывают); фиксированные слои (шапка, плашка cookies) скрываются.
// Для каждого куска текста (Range.getClientRects): закрытые <details> — мимо; сверху в точке должен быть он сам
// (elementFromPoint); два снимка — с текстом и с прозрачным; видимым считается кусок, где различаются ≥ 3 % пикселей;
// куски, вылезающие за край экрана (карусели), — мимо;
// фон — пиксели снимка без текста; контраст WCAG цвета текста к 10-му перцентилю фона (худшие 10 %).
// Порог 4,5:1, для крупного текста (≥ 24 px или ≥ 18,66 px полужирным) — 3:1. Печатает строки JSON.
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/zamer_fon.js http://127.0.0.1:8001 dark|light 1280|390 / /115-fz/ …
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSN, TEMA, SH, ...PUTI] = process.argv.slice(2);
const W = +SH, H = W > 600 ? 800 : 844;

function lum(r, g, b) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(t => { try { localStorage.setItem('tema', t); localStorage.setItem('dlk_obnovleniya_vid', '9'); } catch (e) {} }, TEMA);
  const dek = await ctx.newPage();
  await dek.setContent('<canvas id=c></canvas>');
  let p = await ctx.newPage();
  for (const put of PUTI) {
   try {
    if (p.isClosed()) p = await ctx.newPage();
    try {
      await p.goto(OSN + put, { waitUntil: 'load', timeout: 30000 });
    } catch (e) { console.error('ERR', put, e.message); continue; }
    await p.waitForTimeout(1300);
    // заморозить движение, спрятать баннеры поверх содержимого не трогаем — честный вид
    await p.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}' });
    { const vv = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < vv; y += H * 0.8) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); }
    await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const ps = getComputedStyle(e).position;
      if ((ps === 'fixed' || ps === 'sticky') && e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.setProperty('visibility', 'hidden', 'important'); } });
    const vysota = await p.evaluate(() => document.documentElement.scrollHeight);
    // куски текста
    const kuski = await p.evaluate(() => {
      const res = []; let ei = 0;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,noscript,svg,canvas')) continue;
        { const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue; } // закрытый <details>: прямоугольники есть, текста не видно
        const cs = getComputedStyle(el);
        if (cs.visibility !== 'visible') continue;
        let op = 1, a = el;
        while (a) { op *= +getComputedStyle(a).opacity; a = a.parentElement; }
        if (op < 0.99) continue;
        if (!el.dataset.zf) el.dataset.zf = String(ei++);
        const r = document.createRange(); r.selectNodeContents(n);
        const m = cs.color.match(/[\d.]+/g).map(Number);
        const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400;
        const krup = fs >= 24 || (fs >= 18.66 && fw >= 700);
        for (const q of r.getClientRects()) {
          if (q.width < 4 || q.height < 6) continue;
          res.push({ x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height,
            c: m, krup, ei: el.dataset.zf, t: n.nodeValue.trim().slice(0, 40),
            sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') });
        }
      }
      return res;
    });
    // скрыть текст
    const SKR = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}';
    const st = await p.addStyleTag({ content: '/**/' });
    for (let y0 = 0; y0 < vysota; y0 += H) {
      await p.evaluate(y => window.scrollTo(0, y), y0);
      await p.waitForTimeout(120);
      const sy = await p.evaluate(() => scrollY);
      await st.evaluate(e => { e.textContent = ''; });
      await p.waitForTimeout(30);
      const pngA = (await p.screenshot()).toString('base64');
      await st.evaluate((e, c) => { e.textContent = c; }, SKR);
      await p.waitForTimeout(30);
      const png = (await p.screenshot()).toString('base64');
      let zdes = kuski.filter(k => !k.gotov && k.y >= sy && k.y + k.h <= sy + H && k.x >= 0 && k.x + k.w <= W);
      // кто сверху в точке куска: перекрытые (в т. ч. оборотной стороной карточки) — мимо
      const pe = await p.addStyleTag({ content: '*,*::before,*::after{pointer-events:auto!important}' });
      const vidno = await p.evaluate(([zd, sy]) => zd.map(k => {
        const el = document.querySelector('[data-zf="' + k.ei + '"]');
        if (!el) return false;
        for (const fx of [0.15, 0.5, 0.85]) {
          const h = document.elementFromPoint(k.x + k.w * fx - scrollX, k.y - sy + k.h / 2);
          if (!h || !(h === el || el.contains(h) || h.contains(el))) return false;
        }
        return true;
      }), [zdes, sy]);
      await pe.evaluate(e => e.remove());
      zdes.forEach((k, i) => { if (!vidno[i]) k.gotov = true; });
      zdes = zdes.filter((k, i) => vidno[i]);

      if (!zdes.length) continue;
      // фиксированные слои (шапка) перекрывают текст — пропускаем куски под шапкой сверху 64px, кроме y0=0
      const pix = await dek.evaluate(async ([b64, b64A, zd, sy, verh]) => {
        const ld = async b => { const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x; };
        const x = await ld(b64), xA = await ld(b64A);
        return zd.map(k => {
          const yy = Math.round(k.y - sy);
          if (!verh && yy < 70) return null;
          const R = [Math.max(0, Math.round(k.x)), Math.max(0, yy), Math.max(1, Math.round(k.w)), Math.max(1, Math.round(k.h))];
          const d = x.getImageData(...R).data, dA = xA.getImageData(...R).data;
          let raz = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - dA[i]) + Math.abs(d[i + 1] - dA[i + 1]) + Math.abs(d[i + 2] - dA[i + 2]) > 30) raz++;
          if (raz < d.length / 4 * 0.03) return null;
          const out = [];
          for (let i = 0; i < d.length; i += 4 * 3) out.push([d[i], d[i + 1], d[i + 2]]);
          return out;
        });
      }, [png, pngA, zdes, sy, y0 === 0]);
      zdes.forEach((k, i) => {
        k.gotov = true;
        if (!pix[i]) return;
        const [r, g, b, al = 1] = k.c;
        const ks = pix[i].map(([R, G, B]) => {
          const cr = r * al + R * (1 - al), cg = g * al + G * (1 - al), cb = b * al + B * (1 - al);
          return kontrast(lum(cr, cg, cb), lum(R, G, B));
        }).sort((a, b) => a - b);
        const p10 = ks[Math.floor(ks.length * 0.1)], med = ks[Math.floor(ks.length / 2)];
        const porog = k.krup ? 3 : 4.5;
        if (p10 < porog) console.log(JSON.stringify({ put, tema: TEMA, w: W, p10: +p10.toFixed(2), med: +med.toFixed(2), porog, sel: k.sel, t: k.t, y: Math.round(k.y) }));
      });
    }
    await st.evaluate(e => e.remove());
    console.error('OK', put);
   } catch (e) { console.error('ERRP', put, String(e.message).slice(0, 120)); try { await p.close(); } catch (_) {} }
  }
  await br.close();
})();
