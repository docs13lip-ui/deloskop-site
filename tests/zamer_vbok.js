// vbok-320 (23.10.2026, [Ночные запуски]): замер «шире экрана» — scrollWidth страницы и элементы за правым краем
// (кроме fixed и того, что внутри своей прокрутки). Не сторож: нужен Playwright и сервер.
// Пример: python3 -m http.server 8001 & W=320,360,375 P=/,/tarify/ node tests/zamer_vbok.js
'use strict';
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const OSNOVA = process.env.OSNOVA || 'http://127.0.0.1:8001';
(async () => {
  const b = await chromium.launch();
  const pages = (process.env.P||'/,/tarify/,/indeks/,/pasport/,/115-fz/,/company/,/o-proekte/,/praktika/,/kak-vidit-bank/,/nalichnye/,/skoraya-115-fz/,/osnovatel/').split(',');
  for (const w of (process.env.W||'320').split(',').map(Number)) for (const p of pages) {
    const c = await b.newContext({viewport:{width:w,height:640}, colorScheme:'dark'});
    const pg = await c.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto(OSNOVA+p,{waitUntil:'load'}); await pg.waitForTimeout(600);
    const r = await pg.evaluate((w)=>{const sw=document.documentElement.scrollWidth; const out=[];
      for (const el of document.querySelectorAll('body *')){const cs=getComputedStyle(el); if(cs.position==='fixed')continue; const rc=el.getBoundingClientRect(); if(rc.width&&rc.right>w+0.5){ let a=el.parentElement,skip=false; while(a){ const s=getComputedStyle(a); if(['auto','scroll','hidden','clip'].includes(s.overflowX)&&a!==document.body&&a!==document.documentElement){skip=true;break} a=a.parentElement} if(!skip) out.push((el.tagName+'.'+[...el.classList].join('.')+'#'+el.id).slice(0,60)+' r='+Math.round(rc.right)+' w='+Math.round(rc.width))}}
      return {sw, out: out.slice(0,8)}},w);
    console.log(w, p, 'scrollW', r.sw, errs.length?'JS:'+errs.length:'', r.sw>w? r.out.join(' | '):'');
    await c.close();
  }
  await b.close();
})();
