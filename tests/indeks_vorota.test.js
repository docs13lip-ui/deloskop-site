// «Ворота полноты» Индекса в отчёте (Очередь п. 71, п. 81; аудит 27.09, Г и Д).
// Число Индекса — только когда сервер разрешил: балл 1–99, полнота ≥ 60 %, не ИП.
// Запуск: node --test tests/indeks_vorota.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const V = require('../js/indeks-vorota.js');

const OOO = { company: { inn: '7707083893', kind: 'LEGAL' } };
const s = (o) => Object.assign({}, OOO, o);

test('живой API сегодня (dossier.score, без indeks) — число не показываем', () => {
  const v = V.vid(s({ dossier: { score: 72, headline: 'Надёжная компания' } }));
  assert.strictEqual(v.rezhim, 'schitaem');
  assert.strictEqual(v.polnota, null);
  assert.match(V.tekstSchitaem(v), /не[ \u00a0]меньше 60/);
});

test('полнота ниже 60 % — «считаем, собрано N %», даже если балл пришёл', () => {
  const v = V.vid(s({ indeks: 69, polnota: 55 }));
  assert.strictEqual(v.rezhim, 'schitaem');
  assert.strictEqual(v.polnota, 55);
  assert.match(V.tekstSchitaem(v), /собрано 55% данных, для балла нужно 60%/);
});

test('ответ по договорённости с [Данными]: indeks null + indeks_status schitaem', () => {
  const v = V.vid(s({ indeks: null, indeks_status: 'schitaem', polnota: 30, ne_hvataet: ['fns', 'girbo'] }));
  assert.deepStrictEqual([v.rezhim, v.polnota], ['schitaem', 30]);
});

test('ворота открыты — число, зона по /indeks/', () => {
  assert.deepStrictEqual(pick(V.vid(s({ indeks: 74, polnota: 67 }))), ['chislo', 74, 'Без серьёзных сигналов']);
  assert.deepStrictEqual(pick(V.vid(s({ indeks: { ball: 50, polnota: 60 } }))), ['chislo', 50, 'Есть вопросы']);
  assert.deepStrictEqual(pick(V.vid(s({ indeks: 49, polnota: 90 }))), ['chislo', 49, 'Есть серьёзные сигналы']);
  assert.deepStrictEqual(pick(V.vid(s({ indeks: 12, polnota: 90 }))), ['chislo', 12, 'Много признаков риска']);
});
function pick(v) { return [v.rezhim, v.ball, v.zona]; }

test('шкала 1–99: 0, 100 и дробные не показываем; без полноты — тоже', () => {
  for (const b of [0, 100, 72.5, -3]) assert.strictEqual(V.vid(s({ indeks: b, polnota: 80 })).rezhim, 'schitaem', String(b));
  assert.strictEqual(V.vid(s({ indeks: 72 })).rezhim, 'schitaem', 'нет полноты — нет числа');
  assert.strictEqual(V.vid(s({ indeks: 72, polnota: 80, indeks_status: 'schitaem' })).rezhim, 'schitaem');
});

test('ИП — Индекс не считаем и не показываем вовсе', () => {
  assert.strictEqual(V.vid({ company: { inn: '500100732259', kind: 'INDIVIDUAL' }, indeks: 80, polnota: 90 }).rezhim, 'ip');
  assert.strictEqual(V.vid({ company: { inn: '500100732259' }, indeks: 80, polnota: 90 }).rezhim, 'ip');
});

test('три даты: продукт, сведения источников, пересчёт', () => {
  const t = V.triDaty({ daty: { produkt: '2026-09-28', dannye: { 'ЕГРЮЛ': '2026-09-27', 'ФНС': '2026-09-01' }, pereschet: '2026-09-28' } });
  assert.strictEqual(t.length, 3);
  assert.match(t[1], /ЕГРЮЛ — на 2026-09-27; ФНС — на 2026-09-01/);
  assert.deepStrictEqual(V.triDaty({}), []);
});

test('report.html: нет старой шкалы «/100» и D.score; подключены ворота', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.ok(!/D\.score/.test(r), 'D.score (старая формула) не должен выводиться');
  assert.ok(!/<small>\/100<\/small>/.test(r), 'шкала /100 вместо 1–99');
  assert.ok(!/Индекс надёжности Делоскопа — сводная оценка/.test(r));
  assert.match(r, /<script src="\/js\/indeks-vorota\.js"><\/script>/);
  assert.match(r, /Индекс(?:&nbsp;| )— считаем/);
});
