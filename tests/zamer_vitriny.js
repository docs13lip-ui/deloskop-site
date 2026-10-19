// vitrina-v2: замер витрины главной в Chromium (не сторож — node --test его не запускает).
// Запуск: python3 -m http.server 8001 (из корня сайта), затем
//   node tests/zamer_vitriny.js http://127.0.0.1:8001 [dark|light]
// Для 1280 и 390 px: высота витрины и страницы, CLS загрузки, кадр при прокрутке витрины с CPU ×4 (медиана и 95-й
// процентиль интервала кадров), слои глубины на сцену, перекрытие бабла «Отзыв» с кнопками при прокрутке
// всей страницы шагом 120 px (бабл видим и пересекает кнопку — случай), ошибки JS.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [OSNOVA = 'http://127.0.0.1:8001', REZHIM = 'dark'] = process.argv.slice(2);

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of (process.env.TOLKO ? [[+process.env.TOLKO, 900]] : [[1280, 900], [390, 800]])) {
    const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: REZHIM, hasTouch: w < 800 });
    await c.addInitScript((t) => { try { localStorage.setItem('tema', t); } catch (e) {} }, REZHIM);
    const p = await c.newPage();
    let oshibki = 0;
    p.on('pageerror', () => oshibki++);
    await p.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await p.goto(OSNOVA + '/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const v = document.getElementById('vitrina');
      const s = v && v.querySelector('.vit-e__scena');
      return { vitrina: v ? Math.round(v.offsetHeight) : 0, stranica: document.documentElement.scrollHeight, cls: +window.__cls.toFixed(3),
        sloev: s ? s.children.length : 0 };
    });
    // бабл и кнопки
    const perekr = process.env.BEZ_BABLA ? -2 : await p.evaluate(async () => {
      const fb = document.getElementById('fbOpen'); if (!fb) return -1;
      const ck = document.querySelector('.ck-bar'); if (ck) ck.remove();
      const kn = [...document.querySelectorAll('.vit-btn, .vit-lnk, .vit-e__fb, .ot-btn, .lip, .btn, .check button, a.shapka__btn')];
      let n = 0;
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y < H; y += 120) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 700));
        const f = fb.getBoundingClientRect(), st = getComputedStyle(fb);
        if (+st.opacity < 0.5 || st.pointerEvents === 'none') continue;
        if (kn.some((k) => { const q = k.getBoundingClientRect(); return q.width && q.left < f.right && q.right > f.left && q.top < f.bottom && q.bottom > f.top; })) n++;
      }
      return n;
    });
    // кадр при прокрутке витрины, CPU ×4
    const cdp = await c.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const kadr = await p.evaluate(async () => {
      const v = document.getElementById('vitrina'); const top = v.getBoundingClientRect().top + scrollY;
      window.scrollTo(0, top); await new Promise((r) => setTimeout(r, 300));
      const t = []; let pr = performance.now(), y = top;
      await new Promise((gotovo) => {
        function shag(now) { t.push(now - pr); pr = now; y += 12; window.scrollTo(0, y); if (y < top + v.offsetHeight - innerHeight) requestAnimationFrame(shag); else gotovo(); }
        requestAnimationFrame(shag);
      });
      t.sort((a, b) => a - b);
      return { mediana: +t[Math.floor(t.length / 2)].toFixed(1), p95: +t[Math.floor(t.length * 0.95)].toFixed(1), kadrov: t.length };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`${w}: витрина ${r.vitrina} px · страница ${r.stranica} px · CLS ${r.cls} · слоёв на сцену ${r.sloev} · кадр ×4 медиана ${kadr.mediana} мс, p95 ${kadr.p95} мс (${kadr.kadrov}) · бабл на кнопке ${perekr} · JS ${oshibki}`);
    await c.close();
  }
  await b.close();
})();
