// primer-predel-v1 (24.10, [Ночные запуски]): вывод примера «ООО «Пример»» в разметке — тот же, что рисует js/usloviya.js.
// Было: в HTML «до 1 500 000 ₽», а через 1,5–2,5 с после загрузки модуль «Условия сделки» дорисовывал «до 900 000 ₽»
// (выручка 48 млн ₽ ÷ 26 = 1,85 млн, половина при замечании, округлили вниз) — на первом экране 1280 число менялось само;
// на /kak-vidit-bank/ тот же «Пример» оставался с 1 500 000 ₽. Сторож: считаем предел по данным из index.html той же формулой.
// node --test tests/primer_predel.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const U = require('../js/usloviya.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const G = chitat('index.html');
const S = chitat('kak-vidit-bank/index.html');
const tekst = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| | /g, ' ').replace(/\s+/g, ' ').trim();

// данные примера — дословно из вызова Usloviya.mount(ex, {...}, {compact:true}) на главной
function dannyePrimera() {
  const a = G.indexOf('Usloviya.mount(ex,');
  assert.ok(a > 0, 'на главной нет Usloviya.mount(ex, …) — пример «Условий сделки» переехал?');
  const b = G.indexOf(',{compact:true}', a);
  assert.ok(b > a, 'не нашли конец данных примера');
  const lit = G.slice(a + 'Usloviya.mount(ex,'.length, b).replace(/\/\/[^\n]*\n/g, '\n');
  return new Function('return (' + lit + ');')();
}

const r = dannyePrimera();
const v = U.decide(r, { amount: 0, regime: 'osno', napravlenie: 'platim' });
const ozhid = tekst(v.headline);

test('данные примера дают предел — вывод с суммой, а не «предварительно»', () => {
  assert.strictEqual(r.company.inn, '0000000000');
  assert.ok(v.cap > 0, 'предел не посчитался');
  assert.match(ozhid, /^Можно, предоплата — до \d[\d ]* ₽$/, ozhid);
});

test('главная: вывод в разметке начинается с того же предела, что дорисует модуль', () => {
  const m = G.match(/<div class="verdict" data-usl-demo>([\s\S]*?)<\/div>/);
  assert.ok(m, 'нет <div class="verdict" data-usl-demo>');
  const t = tekst(m[1]);
  assert.ok(t.startsWith(ozhid + '.'), 'в разметке «' + t + '», модуль нарисует «' + ozhid + '»');
  // причина та же, что у модуля
  v.reasons.forEach((x) => assert.ok(t.toLowerCase().includes(x.toLowerCase()), 'нет причины «' + x + '»'));
});

test('/kak-vidit-bank/: оба вывода «Примера» — тот же предел', () => {
  const vse = [...S.matchAll(/<p class="kvb-vyvod[^"]*">([\s\S]*?)<\/p>/g)].map((m) => tekst(m[1]));
  assert.strictEqual(vse.length, 2, 'ждали два вывода (шаг 04 и снимок)');
  vse.forEach((t) => assert.ok(t.startsWith(ozhid + '.'), '«' + t + '» ≠ «' + ozhid + '»'));
});

test('других сумм предела у «Примера» на страницах нет', () => {
  const chislo = ozhid.replace(/^.*до /, '');
  for (const [imya, s] of [['index.html', G], ['kak-vidit-bank', S]]) {
    const vstr = tekst(s).match(/Можно, предоплата — до [\d ]+ ₽/g) || [];
    vstr.forEach((x) => assert.ok(x.endsWith(chislo), imya + ': «' + x + '»'));
  }
});
