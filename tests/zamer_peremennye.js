// zamer_peremennye ([Ночные запуски] 09.11): ищет в Chromium правила, которые ЗОВУТ
// CSS-переменную, а на этой странице и в этой теме её нет (var(--x) без запасного
// значения → свойство молча падает в «наследовать», цвет/отступ берётся у родителя).
// Считаются только правила, которые реально применяются хотя бы к одному элементу.
// Запуск: python3 -m http.server 8001 (из корня), затем
//   node tests/zamer_peremennye.js http://127.0.0.1:8001 light|dark / /115-fz/ …
// Без путей — все страницы из sitemap.xml (кроме /company/). Инструмент, не CI.
const { chromium } = require('playwright');
const fs = require('fs');
const [OSN, TEMA, ...ARG] = process.argv.slice(2);
let PUTI = ARG;
if (!PUTI.length) {
  const sm = fs.readFileSync(__dirname + '/../sitemap.xml', 'utf8');
  PUTI = [...sm.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(m => m[1]).filter(p => !p.startsWith('/company/'));
}
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(t => { try { localStorage.setItem('tema', t); localStorage.setItem('dlk_obnovleniya_vid', '9'); } catch (e) {} }, TEMA);
  const p = await ctx.newPage();
  let vsego = 0;
  for (const put of PUTI) {
    try { await p.goto(OSN + put, { waitUntil: 'load', timeout: 30000 }); } catch (e) { console.error('ERR', put); continue; }
    await p.waitForTimeout(400);
    const naid = await p.evaluate(() => {
      const out = new Set();
      const obhod = (rules, src) => {
        for (const r of rules) {
          if (r.cssRules && !r.selectorText) { try { if (r.media && !matchMedia(r.media.mediaText).matches) continue; } catch (e) {} obhod(r.cssRules, src); continue; }
          if (!r.style || !r.selectorText) continue;
          // по cssText, а не по r.style[i]: у сокращений (background, border…) с var()
          // длинные свойства пусты, и r.style[i] их не показывает
          for (const kus of r.style.cssText.split(/;(?![^(]*\))/)) {
            const k = kus.indexOf(':'); if (k < 0) continue;
            const svo = kus.slice(0, k).trim(), zn = kus.slice(k + 1);
            if (svo.startsWith('--')) continue;
            // какие переменные реально нужны: у var(--a, запас) запас смотрим, только если --a нет
            const nuzhny = (v, el, acc) => {
              let i = 0;
              while ((i = v.indexOf('var(', i)) >= 0) {
                let d = 1, j = i + 4; while (j < v.length && d) { if (v[j] === '(') d++; else if (v[j] === ')') d--; j++; }
                const vnutri = v.slice(i + 4, j - 1); const z = vnutri.indexOf(',');
                const imya = (z < 0 ? vnutri : vnutri.slice(0, z)).trim();
                const est = getComputedStyle(el).getPropertyValue(imya).trim() !== '';
                if (!est) { if (z < 0) acc.add(imya); else nuzhny(vnutri.slice(z + 1), el, acc); }
                i = j;
              }
              return acc;
            };
            if (!zn.includes('var(')) continue;
            let els = [];
            try { els = [...document.querySelectorAll(r.selectorText.replace(/::?(before|after|placeholder|marker|selection|-webkit-[\w-]+)/g, ''))].slice(0, 30); } catch (e) { continue; }
            const schet = {};
            for (const el of els) for (const v of nuzhny(zn, el, new Set())) schet[v] = (schet[v] || 0) + 1;
            for (const v in schet) out.add(src + ' | ' + r.selectorText.slice(0, 80) + ' { ' + svo + ' } ← ' + v + ' (' + schet[v] + ')');
          }
        }
      };
      for (const ss of document.styleSheets) { let rr; try { rr = ss.cssRules; } catch (e) { continue; } obhod(rr, (ss.href || 'inline').replace(location.origin, '')); }
      return [...out];
    });
    for (const s of naid) { console.log(put, '|', s); vsego++; }
  }
  console.log('ИТОГО', TEMA, PUTI.length, 'страниц, мест:', vsego);
  await br.close();
})();
