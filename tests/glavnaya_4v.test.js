'use strict';
// glavnaya-4v-v1 ([Ночные запуски] 31.10.2026): главная говорит о четырёх вопросах в том же порядке, что экран отчёта
// (ekran-4-voprosa-v1: 1 «Что это значит для сделки» → 2 «Насколько полна проверка» → 3 «Что сделать до оплаты» → 4 «Что нашли»),
// а пример первого экрана показывает плашку полноты сразу под выводом — с числами из data/istochniki.json.
// Подключат источник или заморозят новый — сторож покраснеет, пока числа в примере не обновят.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const R = JSON.parse(fs.readFileSync(path.join(K, 'data/istochniki.json'), 'utf8'));
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
const dmy = (s) => s.split('-').reverse().join('.');

const GR = R.istochniki.filter((x) => x.id !== 'zsk_cbr'); // как в отчёте: группа риска ЦБ — отдельной строкой
const N = GR.filter((x) => x.sostoyanie === 'podklyuchen').length;
const M = GR.length;
const PL = /<div class="ex-pl"[^>]*>[\s\S]*?<\/p><\/div>/.exec(G);

test('пример: плашка полноты есть и стоит сразу после вывода', () => {
  assert.ok(PL, 'нет плашки .ex-pl в примере');
  const i = G.indexOf('<div class="ex-pl"');
  const vd = G.lastIndexOf('<div class="ex-vd', i), f = G.indexOf('<div class="ex-f"', vd);
  assert.ok(vd > 0 && vd < i && i < f, 'порядок: вывод → полнота → факты');
});

test('пример: «Проверено N из M» = реестр источников', () => {
  const t = tekst(PL[0]);
  assert.ok(t.includes(`Проверено ${N} из ${M} групп источников.`), t);
  assert.match(PL[0], new RegExp(`data-polnota-primer="${N}/${M}"`));
  assert.strictEqual((PL[0].match(/<i class="on"><\/i>/g) || []).length, N, 'зелёных сегментов = N');
  assert.strictEqual((PL[0].match(/<i(?: class="on")?><\/i>/g) || []).length, M, 'всего сегментов = M');
  const zam = [...new Set(GR.filter((x) => x.sostoyanie === 'zamorozhen').map((x) => x.zamorozhen_s))];
  assert.strictEqual(zam.length, 1, 'одна дата заморозки — иначе перепишите строку примера');
  assert.ok(t.includes('на 12.10.2026') && dmy(zam[0]) === '12.10.2026', 'дата заморозки = реестр');
  assert.ok(GR.some((x) => x.id === 'efrsb' && x.sostoyanie === 'ne_podklyuchen') === /банкротства не подключены/.test(t));
  assert.match(t, /«Не проверяли» — не то же, что «не нашли»\./);
});

test('пример: «неизвестно» не красим в цвета риска', () => {
  assert.ok(!/warn|high|bad/.test(PL[0]), 'в плашке полноты нет классов риска');
});

test('«Что вы увидите в отчёте» — порядок экрана отчёта', () => {
  const i = G.indexOf('id="shield"'), s = G.slice(i, G.indexOf('</section>', i));
  const h = [...s.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1].replace(/&nbsp;/g, ' '));
  assert.deepStrictEqual(h, ['Что это значит для сделки', 'Насколько полна проверка', 'Что сделать до оплаты', 'Что нашли']);
  const rep = path.join(K, 'js/chetyre-voprosa.js');
  if (fs.existsSync(rep)) { // после ekran-4-voprosa-v1: те же заголовки в модуле отчёта
    const js = fs.readFileSync(rep, 'utf8');
    for (const z of h) assert.ok(js.replace(/\\u00a0|&nbsp;| /g, ' ').includes(z), 'в отчёте нет «' + z + '»');
  }
});
