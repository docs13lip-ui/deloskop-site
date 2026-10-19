// vizual-v3.3 «Как вас видит банк» — /kak-vidit-bank/ (ТЗ: claude/Визуал_v3_концепция_и_супер-промт_18.10.md §7, волна 3.3).
// Сторож честности: история — только на данных примера с главной (никаких новых фактов), числа Индекса нет (решение 02.10,
// как glavnaya_primer.test.js), без скриптов страницы, движение — только CSS и только без reduce.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const S = chitat('kak-vidit-bank/index.html');
const G = chitat('index.html');
const C = chitat('css/kak-vidit-bank.css');
const tekst = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|\u2011/g, '-').replace(/\s+/g, ' ');
const main = S.slice(S.indexOf('<main'), S.indexOf('</main>'));

test('мета: title, canonical, в sitemap, в ленте', () => {
  assert.match(S, /<title>Как вас видит банк: пять шагов на примере — Делоскоп<\/title>/);
  assert.match(S, /<link rel="canonical" href="https:\/\/deloskop\.ru\/kak-vidit-bank\/">/);
  assert.ok(chitat('sitemap.xml').includes('<loc>https://deloskop.ru/kak-vidit-bank/</loc>'));
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  assert.ok(L.some((z) => (z.chto_proverit || []).some((c) => c.ssylka === '/kak-vidit-bank/')));
});

test('пять шагов по порядку: компания → банк → налоговая → Индекс → проверьте свою', () => {
  const n = [...main.matchAll(/<p class="kvb-n">(\d\d) · ([^<]+)<\/p>/g)].map((m) => m[1] + ' ' + m[2]);
  assert.deepStrictEqual(n, ['01 Компания', '02 Глазами банка', '03 Глазами налоговой', '04 Индекс', '05 Ваша компания']);
  for (let i = 1; i <= 5; i++) assert.match(main, new RegExp('<section class="kvb-shag[^"]*" id="shag-' + i + '"'));
});

test('данные — только из примера главной: строки фактов и вывод слово в слово', () => {
  const tg = tekst(G);
  for (const f of ['ООО «Пример»', 'ИНН 0000000000 · действующая', 'Сменился 4 месяца назад', 'Отметки о недостоверности',
    'Нет в списке ФНС', 'Без серьёзных сигналов', 'по признакам из реестров', 'ЕГРЮЛ · на дату проверки',
    'ФНС, открытые данные · на дату набора']) {
    assert.ok(tg.includes(f), 'на главной нет «' + f + '»');
    assert.ok(tekst(main).includes(f), 'на странице нет «' + f + '»');
  }
  const vyvod = (s) => tekst((s.match(/<div class="verdict"[^>]*>([\s\S]*?)<\/div>/) || s.match(/<p class="kvb-vyvod[^"]*">([\s\S]*?)<\/p>/))[1]).trim();
  assert.strictEqual(vyvod(S), vyvod(G), 'вывод примера разошёлся с главной');
});

test('числа Индекса в примере нет; дуга — до 72 из 100', () => {
  assert.ok(!/\b72\b/.test(tekst(main)), 'число Индекса в тексте примера (решение 02.10)');
  assert.match(C, /\.kvb-kolco__duga\{[^}]*stroke-dashoffset:28/);
});

test('без скриптов страницы; движение — только при animation-timeline, ширине ≥ 861 px и без reduce', () => {
  assert.ok(!/<script/.test(main), 'скрипт внутри <main>');
  const i = C.indexOf('@supports (animation-timeline: view())');
  assert.ok(i > 0);
  assert.ok(C.indexOf('@keyframes') > i, 'анимации — только внутри @supports');
  assert.match(C.slice(i), /@media \(min-width:861px\) and \(prefers-reduced-motion:no-preference\)/);
  assert.match(C, /\.kvb-scena\{display:none\}/, 'без поддержки сцена скрыта — работают снимки шагов');
});

test('форма проверки уходит на главную отчётом /?inn=', () => {
  assert.match(main, /<form class="kvb-forma" action="\/" method="get"[^>]*><input name="inn"[^>]*required/);
});

test('цвета страницы — только токены ДС (тёмная тема без отдельного слоя)', () => {
  assert.ok(!/#[0-9a-f]{3,6}\b|rgb\(/i.test(C), 'в css/kak-vidit-bank.css цвет числом');
});
