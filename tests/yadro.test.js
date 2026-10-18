// yadro-v1 (18.10.2026, [Ночные запуски]; Визуал v3 §7, шаг 2 волны 3.0): общие стили и скрипты каждой страницы —
// двумя пакетами с отпечатком (css/b/ds.*, js/b/yadro.*) вместо девяти файлов. Ставит tests/sobrat_shapku.py → svernut().
// Сторож читает файлы БЕЗ tests/razvernut_sborku.js — видит теги такими, какие они на сайте.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const KARTA = JSON.parse(fs.readFileSync(path.join(K, 'partials', 'sborka.json'), 'utf8'));
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const DS = /<link rel="stylesheet" href="\/css\/b\/ds\.([0-9a-f]{10})\.css">/g;
const YADRO = /<script src="\/js\/b\/yadro\.([0-9a-f]{10})\.js" defer><\/script>/g;
const teg = (f) => (f.endsWith('.css') ? '<link rel="stylesheet" href="/' + f + '">' : '<script src="/' + f + '" defer></script>');

function stranicy() {
  const out = execFileSync('python3', ['-c', 'import sys; sys.path.insert(0, "tests"); import sobrat_shapku as S; print("\\n".join(S.stranicy()))'], { cwd: K, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

test('пакеты «ds» и «yadro» — на почти всех страницах, по одному разу, тот же адрес, что на главной', () => {
  const glavnaya = chitat('index.html');
  const ds = [...glavnaya.matchAll(DS)].map((m) => m[1]);
  const ya = [...glavnaya.matchAll(YADRO)].map((m) => m[1]);
  assert.strictEqual(ds.length, 1); assert.strictEqual(ya.length, 1);
  let oba = 0;
  const vse = stranicy();
  for (const f of vse) {
    const t = chitat(f);
    const d = [...t.matchAll(DS)], y = [...t.matchAll(YADRO)];
    assert.ok(d.length <= 1 && y.length <= 1, f + ': пакет дважды');
    if (d.length) assert.strictEqual(d[0][1], ds[0], f + ': другой отпечаток ds — python3 tests/sobrat_shapku.py');
    if (y.length) assert.strictEqual(y[0][1], ya[0], f + ': другой отпечаток yadro — python3 tests/sobrat_shapku.py');
    // где стоит пакет — отдельных тегов его файлов нет (иначе файл исполнился бы дважды)
    if (d.length) for (const x of KARTA.pakety.ds) assert.ok(!t.includes(teg(x)), f + ': и пакет, и ' + x);
    if (y.length) for (const x of KARTA.pakety.yadro) assert.ok(!t.includes(teg(x)), f + ': и пакет, и ' + x);
    if (d.length && y.length) oba++;
  }
  assert.ok(oba >= 230, 'страниц с обоими пакетами: ' + oba + ' из ' + vse.length);
});

test('пакет стилей стоит в <head> до glubina.css (как на главной) и после стилей самой страницы', () => {
  for (const f of stranicy()) {
    const t = chitat(f), h = t.slice(0, t.indexOf('</head>'));
    const i = h.search(DS);
    if (i < 0) continue;
    const g = h.indexOf('<link rel="stylesheet" href="/css/glubina.css">');
    if (g >= 0) assert.ok(i < g, f + ': ds после glubina.css');
    const posle = h.slice(i);
    assert.ok(!/<style(?! data-tema)/.test(posle.slice(0, g >= 0 ? g - i : undefined)), f + ': между ds и glubina — стили страницы');
  }
});

test('оболочка карточек из API — с теми же пакетами', () => {
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  assert.match(ob.head, /\/css\/b\/ds\.[0-9a-f]{10}\.css/);
  assert.match(ob.head, /\/js\/b\/yadro\.[0-9a-f]{10}\.js/);
  for (const x of KARTA.pakety.ds.concat(KARTA.pakety.yadro)) assert.ok(!ob.head.includes(teg(x)), 'оболочка: и пакет, и ' + x);
});

test('сворачивание не меняет каскад: страница с чужими стилями между файлами пакета остаётся как была', () => {
  const src = chitat('tests/sobrat_shapku.py');
  const kod = `
import sys; sys.path.insert(0, "tests"); import sobrat_shapku as S
a = '<html><head>\\n<link rel="stylesheet" href="/css/fonts.css">\\n<link rel="stylesheet" href="/css/podval.css">\\n<link rel="stylesheet" href="/css/svoj.css">\\n<link rel="stylesheet" href="/css/shapka.css">\\n<link rel="stylesheet" href="/css/tema.css">\\n</head><body></body></html>'
b = a.replace('<link rel="stylesheet" href="/css/svoj.css">\\n', '')
print(S.svernut(a) == a, "/css/b/ds." in S.svernut(b), S.svernut(S.svernut(b)) == S.svernut(b))`;
  assert.ok(src.includes('def svernut('));
  assert.strictEqual(execFileSync('python3', ['-c', kod], { cwd: K, encoding: 'utf8' }).trim(), 'True True True');
});
