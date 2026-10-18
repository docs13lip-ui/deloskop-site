// vizual-v3.0a: сторожам, которые читают теги <script> страницы, — тот же порядок исполнения, что и до пакетов.
// Страница из partials/sborka.json → «stranicy» подключает пакеты js/b/<имя>.<отпечаток>.js (tests/sobrat_js.py);
// пакет — склейка исходников в порядке из «pakety». При чтении такой страницы через fs.readFileSync первый тег пакета
// заменяется тегами исходников (тот же вид тега); пакеты без тега (по требованию) — за последним defer-пакетом.
// Что пакеты действительно равны исходникам — проверяет tests/sborka_js.test.js (python3 tests/sobrat_js.py --check).
// Подключение: require('./razvernut_sborku.js') в начале сторожа — до первого чтения страницы.
'use strict';
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const KARTA = JSON.parse(fs.readFileSync(path.join(KOREN, 'partials', 'sborka.json'), 'utf8'));
const TEG = /<script src="\/js\/b\/([a-z0-9-]+)\.[0-9a-f]{10}\.js"( defer)?><\/script>\n?|<link rel="stylesheet" href="\/css\/b\/([a-z0-9-]+)\.[0-9a-f]{10}\.css">\n?/g;

// Каждый тег пакета → теги его исходников того же вида (script defer / script / link), по порядку.
// Пакеты страницы без тега (грузятся по требованию — «otchet» на главной) встают сразу за последним defer-пакетом.
function razvernut(html, imena) {
  const sTegom = new Set();
  html.replace(TEG, (m, js, defer, css) => { sTegom.add(js || css); return m; });
  const bezTega = imena.filter((n) => !sTegom.has(n));
  let poslednijDefer = null;
  html.replace(TEG, (m, js, defer) => { if (js && defer) poslednijDefer = js; return m; });
  const skript = (f, d) => '<script src="/' + f + '"' + (d ? ' defer' : '') + '></script>\n';
  return html.replace(TEG, (m, js, defer, css) => {
    if (css) return KARTA.pakety[css].map((f) => '<link rel="stylesheet" href="/' + f + '">\n').join('');
    let t = KARTA.pakety[js].map((f) => skript(f, !!defer)).join('');
    if (js === poslednijDefer) t += bezTega.map((n) => KARTA.pakety[n].map((f) => skript(f, true)).join('')).join('');
    return t;
  });
}

const STRANICY = new Map(Object.entries(KARTA.stranicy).map(([p, imena]) => [path.resolve(KOREN, p), imena]));
if (!fs.readFileSync.__sborka) {
  const iskhodnyj = fs.readFileSync;
  const novyj = function (f, ...ost) {
    const t = iskhodnyj.call(fs, f, ...ost);
    const imena = typeof f === 'string' ? STRANICY.get(path.resolve(f)) : null;
    return imena && typeof t === 'string' ? razvernut(t, imena) : t;
  };
  novyj.__sborka = true;
  fs.readFileSync = novyj;
}

module.exports = { razvernut, KARTA };
