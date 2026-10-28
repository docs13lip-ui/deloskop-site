// indeks-vozrast-v1 ([Ночные запуски] 28.10.2026; п. 408 Очереди, идея [Маркетинг] 27.10): на /indeks/ в «Соберите компанию сами»
// ползунок возраста ставит ровно одну галочку возраста и пишет, когда компания перейдёт на следующую ступень и каким станет
// Индекс при тех же остальных фактах. Сторож: ступени — как в js/indeks-otvet.js, счёт — тем же rasschitat, тексты честные.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const V = require('../indeks/vozrast.js');
const I = require('../indeks/indeks.js');
const KOR = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(KOR, 'indeks/index.html'), 'utf8');
const M = JSON.parse(HTML.match(/<script type="application\/json" id="metodika">([\s\S]*?)<\/script>/)[1]);
const DEN = Date.UTC(2026, 9, 28);
const NB = ' ';

test('ступени возраста совпадают с расчётом отчёта (js/indeks-otvet.js)', () => {
  const otv = fs.readFileSync(path.join(KOR, 'js/indeks-otvet.js'), 'utf8');
  for (const s of ['mes < 6) fakty.vozrast_do_6m', 'mes < 12) fakty.vozrast_6_12m', 'mes < 36) fakty.vozrast_1_3g', 'mes >= 120) fakty.vozrast_10g'])
    assert.ok(otv.includes(s), 'в отчёте ступень: ' + s);
  const ozh = { 0: 'vozrast_do_6m', 5: 'vozrast_do_6m', 6: 'vozrast_6_12m', 11: 'vozrast_6_12m', 12: 'vozrast_1_3g', 35: 'vozrast_1_3g', 36: null, 119: null, 120: 'vozrast_10g', 132: 'vozrast_10g' };
  for (const k in ozh) assert.strictEqual(V.stupen(+k), ozh[k], k + ' мес.');
  for (const id of ['vozrast_do_6m', 'vozrast_6_12m', 'vozrast_1_3g', 'vozrast_10g'])
    assert.ok(M.faktory.some((f) => f.id === id), 'фактор есть в методике: ' + id);
});

test('шкала ползунка: все ступени достижимы, атрибуты в разметке совпадают со шкалой', () => {
  for (const p of [6, 12, 36, 120]) assert.ok(V.SHKALA.includes(p), 'на шкале есть ' + p);
  assert.strictEqual(V.SHKALA[V.SHKALA.length - 1], V.MAX);
  const r = HTML.match(/<input type="range" id="k-vozrast" min="0" max="(\d+)" step="1" value="(\d+)"/);
  assert.ok(r, 'ползунок в разметке');
  assert.strictEqual(+r[1], V.SHKALA.length - 1);
  assert.strictEqual(V.SHKALA[+r[2]], 60, 'по умолчанию — 5 лет (без вклада возраста, как «галочек нет»)');
  assert.ok(/<script src="indeks.js" defer><\/script>\n<script src="vozrast.js" defer><\/script>/.test(HTML), 'vozrast.js — после indeks.js');
  assert.ok(HTML.includes('data-k="cherez" aria-live="polite"'));
});

test('пятимесячная компания без других сигналов: через месяц 64, через 7 — 70, «Без серьёзных сигналов»', () => {
  const p = V.prognoz(M, {}, 5, DEN, I.rasschitat);
  assert.strictEqual(p.sejchas.indeks, 60);
  assert.strictEqual(p.porog, 6);
  assert.strictEqual(p.dnej, 31);
  assert.strictEqual(p.potom.indeks, 64);
  const t = V.tekst(p);
  assert.strictEqual(t, 'Через 31' + NB + 'день, 28' + NB + 'ноября 2026, компании исполнится полгода — при тех же остальных фактах Индекс станет 64.');
  const p2 = V.prognoz(M, {}, 11, DEN, I.rasschitat);
  assert.strictEqual(p2.potom.indeks, 70);
  assert.ok(V.tekst(p2).endsWith('Индекс станет 70, «Без серьёзных сигналов».'), V.tekst(p2));
});

test('календарь не снимает потолок: с отметкой о недостоверном адресе Индекс остаётся прежним', () => {
  const f = { nedostovernyj_adres: true };
  const p = V.prognoz(M, f, 30, DEN, I.rasschitat);
  assert.strictEqual(p.porog, 36);
  assert.strictEqual(p.sejchas.indeks, p.potom.indeks);
  assert.ok(/но Индекс останется \d+: его держат другие сигналы/.test(V.tekst(p)), V.tekst(p));
});

test('больше 10 лет — ступеней дальше нет; стоп-фактор — строки нет', () => {
  const p = V.prognoz(M, {}, 132, DEN, I.rasschitat);
  assert.strictEqual(p.porog, null);
  assert.ok(V.tekst(p).startsWith('Больше 10' + NB + 'лет — время уже засчитано (+3).'));
  assert.strictEqual(V.tekst(V.prognoz(M, { bankrotstvo: true }, 5, DEN, I.rasschitat)), '');
});

test('дальний порог — годами, а не тысячей дней', () => {
  const t = V.tekst(V.prognoz(M, {}, 60, DEN, I.rasschitat));
  assert.strictEqual(t, 'Через 5' + NB + 'лет, 28' + NB + 'октября 2031, компании исполнится 10' + NB + 'лет — при тех же остальных фактах Индекс станет 75.');
  assert.ok(V.tekst(V.prognoz(M, {}, 15, DEN, I.rasschitat)).startsWith('Через 1' + NB + 'год 9' + NB + 'мес., '));
  assert.ok(V.tekst(V.prognoz(M, {}, 0, DEN, I.rasschitat)).startsWith('Через 182' + NB + 'дня, '), 'полгода — ещё днями');
});

test('даты: конец месяца, склонения, возраст словами', () => {
  assert.strictEqual(V.plusMes(Date.UTC(2027, 0, 31), 1), Date.UTC(2027, 1, 28));
  assert.strictEqual(V.plusMes(Date.UTC(2026, 9, 28), 115), Date.UTC(2036, 4, 28));
  assert.strictEqual(V.segodnyaMsk(Date.UTC(2026, 9, 28, 22, 0)), Date.UTC(2026, 9, 29), 'день — по Москве');
  assert.strictEqual(V.vozrastTekst(0), 'меньше месяца');
  assert.strictEqual(V.vozrastTekst(18), '1' + NB + 'год 6' + NB + 'мес.');
  assert.strictEqual(V.vozrastTekst(24), '2' + NB + 'года');
  assert.strictEqual(V.vozrastTekst(60), '5' + NB + 'лет');
  assert.strictEqual(V.vozrastTekst(132), 'больше 10' + NB + 'лет');
  const t = V.tekst(V.prognoz(M, {}, 34, DEN, I.rasschitat));
  assert.ok(t.startsWith('Через 61' + NB + 'день, 28' + NB + 'декабря 2026, компании исполнится 3' + NB + 'года'), t);
});

test('файл не в пакете отчёта и без внешних запросов', () => {
  const kod = fs.readFileSync(path.join(KOR, 'indeks/vozrast.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage/.test(kod));
  assert.ok(!/[a-z][а-яё]|[а-яё][a-z]/i.test(kod.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/'[^']*'/g, '')), 'нет имён со смесью латиницы и кириллицы');
});
