// Типографика: номера дел, законов и писем не рвутся на переносе (js/shapka.js, п. 8).
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
function zagruzit() {
  const win = {};
  const doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  win.document = doc;
  vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'js/shapka.js'), 'utf8'),
    { window: win, document: doc, location: { pathname: '/' }, localStorage: { getItem: () => null } });
  return win.dlkNerazryv;
}
const N = zagruzit();
const nw = t => Array.from(N.kuski(t) || []).filter(c => c.nw).map(c => String(c.t));

test('номера дел ВС и арбитража, законов и писем ФНС — целиком в одном куске', () => {
  assert.deepStrictEqual(nw('Определение ВС № 304-ЭС23-9987 по делу А67-1408/2022.'), ['304-ЭС23-9987', 'А67-1408/2022']);
  assert.deepStrictEqual(nw('ст. 7.7 115-ФЗ и 161-ФЗ'), ['115-ФЗ', '161-ФЗ']);
  assert.deepStrictEqual(nw('приказ ФНС № ММ-3-06/333@ и письмо СД-4-3/11802@'), ['ММ-3-06/333@', 'СД-4-3/11802@']);
  assert.deepStrictEqual(nw('Постановление КС 12-П, определение 3476-О'), ['12-П', '3476-О']);
});

test('слова через дефис без цифр не трогаем; текст собирается обратно без потерь', () => {
  assert.strictEqual(N.kuski('из-за того, что Северо-Запад'), null);
  assert.strictEqual(N.kuski('Без номеров вообще'), null);
  const t = 'Дело А43-21183/2020: ВС 27.05.2024 (№ 301-ЭС22-11144), — и всё.';
  assert.strictEqual(N.kuski(t).map(c => c.t).join(''), t);
});

test('стиль .nw есть в общей шапке (на всех страницах), а функция открыта модулям', () => {
  assert.match(fs.readFileSync(path.join(KOREN, 'css/shapka.css'), 'utf8'), /\.nw\{white-space:nowrap\}/);
  assert.strictEqual(typeof N.obernut, 'function');
});

test('родитель flex/grid (вопрос FAQ в <summary>): куски в одной обёртке .nw-k, вопрос не распадается на колонки', () => {
  const win = { getComputedStyle: el => ({ display: el.d }) };
  const doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  win.document = doc;
  vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'js/shapka.js'), 'utf8'),
    { window: win, document: doc, location: { pathname: '/' }, localStorage: { getItem: () => null } });
  const f = win.dlkNerazryv.vFlex;
  for (const d of ['flex', 'inline-flex', 'grid', 'inline-grid']) assert.strictEqual(f({ nodeType: 1, d }), true, d);
  for (const d of ['block', 'inline', 'list-item', 'table-cell', '']) assert.strictEqual(f({ nodeType: 1, d }), false, d);
  assert.strictEqual(f(null), false);
  assert.strictEqual(N.vFlex({ nodeType: 1 }), false); // без getComputedStyle — как раньше
  assert.match(fs.readFileSync(path.join(KOREN, 'js/shapka.js'), 'utf8'), /className = "nw-k"/);
});
