// vizual-v3.1a «Инструмент» (18.10.2026, [Ночные запуски]): пример → отчёт через View Transitions, адрес отчёта и «Назад»,
// подсказки у поля ИНН — popover по якорю. Визуал v3 §7, волна 3.1 (а, б).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const P = require('../js/perehod.js');

// маленький «документ»: элементы со style и classList, querySelector по таблице
function fakeRep(ex, est) {
  const el = () => ({ style: { viewTransitionName: '' } });
  const tab = {};
  P.PARY.forEach((p) => { tab[ex ? p[1] : p[2]] = est ? el() : null; });
  const fakty = est ? [el(), el(), el(), el()] : [];
  return {
    classList: { contains: (c) => c === 'ex' && ex },
    querySelector: (s) => tab[s] || null,
    querySelectorAll: () => fakty,
    _tab: tab, _fakty: fakty
  };
}
function fakeDoc(vt, reduce) {
  return { defaultView: { matchMedia: () => ({ matches: !!reduce }) }, startViewTransition: vt };
}

test('общие элементы: кольцо, название, вывод и три первых факта — у примера и у отчёта', () => {
  assert.deepStrictEqual(P.elementy(fakeRep(true, true)).map((x) => x[0]),
    ['dlk-kolco', 'dlk-kompaniya', 'dlk-vyvod', 'dlk-fakt-1', 'dlk-fakt-2', 'dlk-fakt-3']);
  assert.deepStrictEqual(P.elementy(fakeRep(false, true)).map((x) => x[0]).length, 6);
  assert.deepStrictEqual(P.elementy(fakeRep(true, false)), [], 'нет элементов — нет имён');
});

test('без View Transitions и при «уменьшить движение» — смена сразу, имён не ставит', async () => {
  for (const doc of [fakeDoc(undefined, false), fakeDoc(() => { throw new Error('не звать'); }, true)]) {
    const rep = fakeRep(true, true);
    let n = 0;
    const r = await P.smena(rep, () => { n++; }, doc);
    assert.strictEqual(n, 1);
    assert.strictEqual(r, false);
    assert.ok(Object.values(rep._tab).every((e) => e.style.viewTransitionName === ''));
  }
});

test('с View Transitions: имена у старого до снимка, у нового — после смены, по окончании сняты', async () => {
  const rep = fakeRep(true, true);
  let doKolbeka = null, posleKolbeka = null, konec;
  const fin = new Promise((ok) => { konec = ok; });
  const doc = fakeDoc((cb) => {
    doKolbeka = rep._tab['.zhi__kolco'].style.viewTransitionName;
    const done = Promise.resolve().then(() => { cb(); posleKolbeka = rep._fakty[0].style.viewTransitionName; });
    return { updateCallbackDone: done, finished: fin };
  });
  let smenil = 0;
  const r = await P.smena(rep, () => { smenil++; }, doc);
  assert.strictEqual(r, true);
  assert.strictEqual(smenil, 1);
  assert.strictEqual(doKolbeka, 'dlk-kolco', 'старое названо до снимка');
  assert.strictEqual(posleKolbeka, 'dlk-fakt-1', 'новое названо после смены');
  konec(); await fin; await new Promise((ok) => setImmediate(ok));
  assert.ok(rep._fakty.every((e) => e.style.viewTransitionName === ''), 'имена сняты — не мешают следующим переходам');
});

test('главная: пакеты подключают переход и стили; переход оборачивает отрисовку отчёта', () => {
  const karta = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(karta.pakety.glavnaya.includes('js/perehod.js'));
  assert.ok(karta.pakety['glavnaya-stil'].includes('css/perehod.css'));
  const h = chitat('index.html');
  assert.match(h, /perehod\(function\(\)\{render\(x\.j,o\)\}\)\.then\(/);
  assert.match(h, /report\.setAttribute\('aria-busy','true'\)/);
  // пример уходит в запас живыми узлами, «Назад» возвращает их (обработчики вкладок и кольца на месте)
  assert.match(h, /exUzly=\[\]\.slice\.call\(report\.childNodes\)/);
  assert.match(h, /window\.addEventListener\('popstate'/);
  const css = chitat('css/perehod.css');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\s*::view-transition-group\(\*\),::view-transition-old\(\*\),::view-transition-new\(\*\)\{animation:none!important\}/);
});

test('адрес отчёта: сейчас /?inn=…; /otchet/<ИНН>/ — выключен до переезда на nginx, сервер к нему готов', () => {
  const h = chitat('index.html');
  // включать вместе с переездом (deploy/PEREEZD.md): Caddy App Platform не отдаёт главную на /otchet/… с кодом 200
  assert.match(h, /var OTCHET_PUT=false;/);
  assert.match(h, /var u=OTCHET_PUT\?'\/otchet\/'\+inn\+'\/':'\/\?inn='\+inn;/);
  assert.match(h, /if\(o&&\(o\.svoj\|\|o\.izIstorii\)/, 'Щит и шаги по истории не пишут новых записей');
  // мягкая 404 не уводит с адреса отчёта, но ставит noindex
  assert.match(h, /document\.head\.appendChild\(m\);if\(\/\^\\\/otchet\\\/\\d\{10\}\(\?:\\d\{2\}\)\?\\\/\?\$\/\.test\(p\)\)return;/);
  const conf = chitat('deploy/nginx.conf');
  assert.match(conf, /location ~ "\^\/otchet\/\(\?:\[0-9\]\{10\}\|\[0-9\]\{12\}\)\/\$" \{\s*rewrite \^ \/index\.html break;/);
  assert.match(conf, /X-Robots-Tag "noindex"[\s\S]*location \/company\//);
});

test('подсказки: popover по якорю только при поддержке, иначе — как было; aria-expanded', () => {
  const h = chitat('index.html');
  assert.match(h, /var POP=!!\(list\.showPopover&&window\.CSS&&CSS\.supports&&CSS\.supports\('position-anchor','--dlk-forma'\)\);/);
  assert.match(h, /list\.setAttribute\('popover','manual'\)/);
  assert.match(h, /input\.setAttribute\('aria-expanded','true'\)/);
  const css = chitat('css/perehod.css');
  assert.match(css, /\.check--yakor\{anchor-name:--dlk-forma\}/);
  assert.match(css, /top:anchor\(bottom\)/);
});
