// pismo-temnaya ([Ночные запуски] 09.11): замер Chromium тёмной темы на 104 страницах — 2 места.
// 1) /115-fz/sovpadenie-s-perechnem-chto-delat/: класс pismo-js ставится на <html> (js/shablon-pisma.js), а слой тёмной
//    темы искал «[data-theme=dark] .pismo-js» (потомка) — 14 полей письма оставались кремовыми #FFF4E0 на тёмном.
// 2) /kak-rabotaet/: значок «PDF» — белый на var(--bad); в тёмной --bad светлый #FF7B72 → 2,6 : 1.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

test('поля письма в тёмной теме: правило на самом <html> (без пробела)', () => {
  const s = chitat('115-fz/sovpadenie-s-perechnem-chto-delat/index.html');
  assert.ok(s.includes('[data-theme=dark].pismo-js .pismo__obr .pismo__p{background:#2E220C;color:#FFCA70}'));
  assert.match(chitat('js/shablon-pisma.js'), /documentElement\.classList\.add\("pismo-js"\)/);
});

test('значок файла на /kak-rabotaet/: текст — --on-accent (в тёмной тёмный на светло-красном)', () => {
  const css = chitat('css/kak-rabotaet.css');
  assert.match(css, /\.kr-fajl__i\{[^}]*background:var\(--bad\);color:var\(--on-accent,#fff\)/);
  assert.doesNotMatch(css, /\.kr-fajl__i\{[^}]*background:var\(--bad\);color:#fff/);
});
