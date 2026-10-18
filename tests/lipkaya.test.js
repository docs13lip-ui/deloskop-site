// vizual-v3.1b «Инструмент» (18.10.2026, [Ночные запуски]): (в) липкая строка «Что делать завтра утром» на телефоне,
// (г) переходы между страницами (cross-document View Transitions), место под отчёт при заходе по адресу отчёта.
// Визуал v3 §7, волна 3.1 (в, г).
'use strict';
require('./razvernut_sborku.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const L = require('../js/lipkaya.js');

// мини-DOM: только то, что зовёт vyvod()
function uzel(cls, txt, deti) {
  const u = { className: cls || '', textContent: txt || '', deti: deti || [], attrs: {},
    classList: { contains: (c) => (' ' + u.className + ' ').indexOf(' ' + c + ' ') >= 0 },
    getAttribute: (a) => u.attrs[a] || null };
  const vse = () => { const o = []; (function obh(x) { x.deti.forEach((d) => { o.push(d); obh(d); }); })(u); return o; };
  const pod = (s) => {
    if (s === '.ot-act a[href]') return (x) => x.attrs.href && x.tag === 'a';
    const k = s.replace(/^\./, '');
    return (x) => x.classList.contains(k);
  };
  u.querySelector = (s) => vse().find(pod(s)) || null;
  u.querySelectorAll = (s) => vse().filter(pod(s));
  return u;
}
function ssylka(cls, t, href) { const a = uzel(cls, t); a.tag = 'a'; a.attrs.href = href; return a; }
function otchet(vt, act) {
  const vd = uzel('ot-vd ot-vd--ok', '', [uzel('ot-ix', '', [uzel('ot-ix__lv', 'Без серьёзных сигналов')]), vt, uzel('ot-act', '', act || [])]);
  return uzel('report ot', '', [vd]);
}

test('вывод для строки и окна — из уже нарисованного отчёта, без новых слов', () => {
  const vt = uzel('ot-vt', '', [uzel('usl go', '', [uzel('usl-t', 'Работать можно'), uzel('usl-r', 'Серьёзных признаков риска не найдено.'),
    uzel('usl-a', '  Сохраните досье с датой проверки.  ')])]);
  const v = L.vyvod(otchet(vt, [ssylka('ot-btn p', 'Следить за компанией', '/cabinet.html#watch'), ssylka('ot-btn s', 'Паспорт контрагента', '/pasport/kontragent/?inn=7707083893')]));
  assert.strictEqual(v.kratko, 'Работать можно');
  assert.deepStrictEqual(v.abzacy, ['Работать можно', 'Серьёзных признаков риска не найдено.', 'Сохраните досье с датой проверки.']);
  assert.deepStrictEqual(v.ssylki.map((x) => [x.t, x.glavnaya]), [['Следить за компанией', true], ['Паспорт контрагента', false]]);
  assert.strictEqual(v.ton, 'ok');
});

test('своя компания (Щит): текст вывода, итог — уровень Индекса; нет вывода — нет строки', () => {
  const v = L.vyvod(otchet(uzel('ot-vt', '', [uzel('ot-vt__p', 'Признаков: 2. Банк может спросить про адрес.')])));
  assert.strictEqual(v.kratko, 'Без серьёзных сигналов');
  assert.deepStrictEqual(v.abzacy, ['Признаков: 2. Банк может спросить про адрес.']);
  assert.strictEqual(L.vyvod(uzel('report ex')), null, 'пример без вывода отчёта — строки нет');
  assert.strictEqual(L.vyvod(null), null);
});

test('без IntersectionObserver или <dialog> — ничего не ставит', () => {
  const doc = { defaultView: {} };
  const rep = otchet(uzel('ot-vt', '', [uzel('usl-t', 'Работать можно')]));
  rep.ownerDocument = doc;
  assert.strictEqual(L.mount(rep), false);
});

test('модуль — в пакете отчёта после otchet.js; главная зовёт mount после раскладки и snyat при «Назад»', () => {
  const k = JSON.parse(chitat('partials/sborka.json')).pakety.otchet;
  assert.ok(k.indexOf('js/lipkaya.js') === k.indexOf('js/otchet.js') + 1);
  const g = chitat('index.html');
  assert.ok(/Otchet\.razlozhit\([^\n]*\n[^\n]*\n\s*if\(window\.DlkLipkaya\)\{try\{DlkLipkaya\.mount\(report\)\}catch\(e\)\{\}\}/.test(g));
  assert.ok(/function vernutPrimer\(\)\{bezOtcheta\(\);[^\n]*\n\s*if\(window\.DlkLipkaya\)try\{DlkLipkaya\.snyat\(\)\}catch\(e\)\{\}/.test(g));
  assert.strictEqual(L.ZAG, 'Что делать завтра утром');
});

test('стили строки: только на телефоне, над окном cookie, без движения при «уменьшить движение», цвета — токенами', () => {
  const c = chitat('css/perehod.css');
  const i = c.indexOf('vizual-v3.1b (в)');
  assert.ok(i > 0);
  const b = c.slice(i);
  assert.ok(/@media \(min-width:601px\)\{\.lip\{display:none\}\}/.test(b));
  assert.ok(/bottom:var\(--lip-niz,0px\)/.test(b));
  assert.ok(/@media \(prefers-reduced-motion:reduce\)\{\.lip,\.lip\.is-on\{transition:none\}dialog\.lip-d\[open\]\{animation:none\}\}/.test(b));
  // светлая тема — запасные значения главной, тёмная — токены tema.css (свои цвета числом сломали бы тёмную тему)
  const golye = b.replace(/var\(--[a-z0-9-]+,[^)]*\)/g, '').replace(/rgba\([^)]*\)/g, '').match(/#[0-9A-Fa-f]{3,6}\b/g);
  assert.strictEqual(golye, null, 'цвет без токена: ' + golye);
});

// (г) — §9 js/shapka.js: что с чем связывает переход между страницами
function para() {
  const t = chitat('js/shapka.js');
  const i = t.indexOf('/* §9. vizual-v3.1b');
  assert.ok(i > 0);
  const m = { exports: {} };
  vm.runInNewContext(t.slice(i), { module: m, addEventListener() {}, URL, location: { origin: 'https://deloskop.ru' } });
  return m.exports;
}

test('переход между страницами: статья → статья, список → карточка, карточка → карточка; остальное — без общего заголовка', () => {
  const P = para();
  const k = '/company/7707083893-sberbank/';
  assert.strictEqual(P.para('/company/', k), 'ssylka');
  assert.strictEqual(P.para('/company/otrasl/energetika/', k), 'ssylka');
  assert.strictEqual(P.para('/company/region/moskva/', k), 'ssylka');
  assert.strictEqual(P.para('/company/0274110679-farmstandart/', k), 'zagolovok');
  assert.strictEqual(P.para('/115-fz/', '/115-fz/zsk-zony-riska/'), 'ssylka');
  assert.strictEqual(P.para('/praktika/nalogi/', '/praktika/nalogi/vokfors-rekonstrukciya/'), 'ssylka');
  assert.strictEqual(P.para('/115-fz/zsk-zony-riska/', '/nalogi/kody-statusa-egryul/'), 'zagolovok');
  assert.strictEqual(P.para('/tarify/', '/indeks/'), '');
  assert.strictEqual(P.para('/', '/115-fz/zsk-zony-riska/'), '');
  assert.strictEqual(P.para(k, '/company/'), '', 'карточка → список: заголовок списка просто проявляется');
  assert.strictEqual(P.para(k, k), '');
});

test('CSS перехода: в источнике шапки, только без «уменьшить движение», имя заголовку — только в переходе между страницами', () => {
  for (const f of ['partials/shapka.css', 'css/shapka.css']) {
    const c = chitat(f);
    assert.ok(/@media \(prefers-reduced-motion:no-preference\)\{\s*@view-transition\{navigation:auto;types:dlk-str\}/.test(c), f);
    // тип dlk-str есть только у переходов между страницами — переход «пример → отчёт» на главной (startViewTransition) заголовок не трогает
    assert.ok(c.includes('html:active-view-transition-type(dlk-str) h1{view-transition-name:dlk-zag}'), f);
  }
  const css = fs.readdirSync(path.join(K, 'css/b')).filter((f) => /^ds\.[0-9a-f]{10}\.css$/.test(f));
  assert.strictEqual(css.length, 1);
  assert.ok(chitat('css/b/' + css[0]).includes('@view-transition{navigation:auto;types:dlk-str}'), 'пакет ds собран заново');
});

test('адрес отчёта: компактная шапка ставится до первой отрисовки и снимается при ошибке и «Назад»', () => {
  const g = chitat('index.html');
  const s = g.split('\n')[5];
  assert.ok(s.startsWith('<script>/* vizual-v3.1b: страница открыта адресом отчёта'));
  const html = { classList: { s: new Set(), add(c) { this.s.add(c); } } };
  for (const [put, poisk, est] of [['/', '?inn=7707083893', true], ['/', '?inn=770708389312', true], ['/otchet/7707083893/', '', true],
    ['/', '?inn=77070', false], ['/', '?inn=%D0%B3%D0%B0%D0%B7', false], ['/', '', false]]) {
    html.classList.s = new Set();
    vm.runInNewContext(s.replace(/^<script>/, '').replace(/<\/script>$/, ''), { document: { documentElement: html }, location: { pathname: put, search: poisk } });
    assert.strictEqual(html.classList.s.has('rezhim-otcheta'), est, put + poisk);
  }
  assert.strictEqual((g.match(/bezOtcheta\(\)/g) || []).length, 6, 'объявление + 5 мест: нет API, 429/ошибка, сеть, опечатка ИНН, «Назад»');
  // по нажатию «Проверить» шапка сжимается сразу (сдвиг — в ответ на действие человека), ответ API меняет только пример на отчёт
  assert.ok(/function runCheck\(v,o\)\{[\s\S]{0,600}?document\.documentElement\.classList\.add\('rezhim-otcheta'\);/.test(g));
  // стекло примера (backdrop-filter) Chromium считает шире блока — пока ждём ответ, его нет, иначе смена примера на отчёт = CLS 0,17–0,39
  assert.ok(chitat('css/glubina.css').includes(' .report.ex.loading,.rezhim-otcheta .report.ex{background:#fff;-webkit-backdrop-filter:none;backdrop-filter:none}'));
  assert.ok(chitat('css/tema.css').includes('[data-theme=dark] .report.ex.loading,[data-theme=dark] .rezhim-otcheta .report.ex{background:#1C1C1F}'), 'тёмная тема — своим цветом');
});
