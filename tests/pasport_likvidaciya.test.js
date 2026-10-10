// pasport-likvidaciya-v1 [Ночные-3] 10.10.2026: Паспорт контрагента при ликвидации и исключении из ЕГРЮЛ.
// В разделе «Предел аванса» (бесплатный) — строка «Что сделать»: текст [Право] из справочника кодов ЕГРЮЛ
// (data/statusy-egryul.json, поля sdelat и norma), выбранный по коду состояния. Без кода — как раньше.
// Запуск: node --test tests/pasport_likvidaciya.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const SK = require('../js/status-kod.js');
const U = require('../js/usloviya.js');
const P = require('../js/pasport-kontragenta.js');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/statusy-egryul.json'), 'utf8'));
const G = Object.fromEntries(D.gruppy.map((g) => [g.id, g]));

function otvet(st, kod) {
  const c = { inn: '7700000101', ogrn: '1027700000101', kind: 'LEGAL', name_short: 'ООО «Тест»', status: st, reg_date: '2012-03-01' };
  if (kod !== undefined) c.state_code = kod;
  return { checked_at: '2026-10-10T18:30:00+03:00', risk_level: 'high', company: c, signals: [],
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 120000000 }] } };
}
const fakt = (p, id, t) => (p.razdely.find((x) => x.id === id).fakty || []).find((f) => f.tekst === t);

test('тексты кредитору — дословно из справочника кодов ЕГРЮЛ (поля sdelat и norma), новых формулировок нет', () => {
  for (const v of ['likvidaciya', 'isklyuchenie', 'isklyuchena']) {
    assert.strictEqual(SK.KREDITORU[v].tekst, G[v].sdelat, v);
    assert.strictEqual(SK.KREDITORU[v].norma, G[v].norma, v);
    assert.ok(G[v].otkuda_tekst && /\[Право\]/.test(G[v].otkuda_tekst), v + ': текст согласован [Право]');
  }
});

test('kreditoru: вид — по коду состояния; без кода, у действующей и при реорганизации — null', () => {
  assert.strictEqual(SK.kreditoru('LIQUIDATING', '101').vid, 'likvidaciya');
  assert.strictEqual(SK.kreditoru('LIQUIDATING', 102).vid, 'likvidaciya');
  for (const k of ['105', '106', '107', '108', '110']) assert.strictEqual(SK.kreditoru('LIQUIDATING', k).vid, 'isklyuchenie', k);
  for (const k of ['407', '414', '415', '418', '420']) assert.strictEqual(SK.kreditoru('LIQUIDATED', k).vid, 'isklyuchena', k);
  assert.strictEqual(SK.kreditoru('LIQUIDATING', ''), null);
  assert.strictEqual(SK.kreditoru('LIQUIDATING', undefined), null);
  assert.strictEqual(SK.kreditoru('ACTIVE', '101'), null);
  assert.strictEqual(SK.kreditoru('REORGANIZING', '124'), null);
});

for (const [st, kod, vid] of [['LIQUIDATING', '101', 'likvidaciya'], ['LIQUIDATING', '105', 'isklyuchenie'], ['LIQUIDATING', '108', 'isklyuchenie'], ['LIQUIDATED', '407', 'isklyuchena']]) {
  test('Паспорт, ' + st + ' ' + kod + ': «Что сделать» в пределе аванса — текст группы «' + G[vid].nazv + '»', () => {
    const p = P.sobrat(otvet(st, kod), { usloviya: U });
    const f = fakt(p, 'predel', 'Что сделать');
    assert.ok(f, 'есть строка');
    assert.strictEqual(f.znachenie, G[vid].sdelat);
    assert.strictEqual(f.ton, 'bad');
    assert.strictEqual(f.istochnik, 'ЕГРЮЛ; ' + G[vid].norma);
    assert.strictEqual(fakt(p, 'predel', 'Предел аванса').znachenie, U.money(0));
  });
}

test('у ликвидируемой — про ликвидатора и без «возражения»; у исключаемой — наоборот', () => {
  const l = fakt(P.sobrat(otvet('LIQUIDATING', '101'), { usloviya: U }), 'predel', 'Что сделать').znachenie;
  assert.match(l, /ликвидатору/); assert.doesNotMatch(l, /возражени/);
  const i = fakt(P.sobrat(otvet('LIQUIDATING', '106'), { usloviya: U }), 'predel', 'Что сделать').znachenie;
  assert.match(i, /возражение/); assert.doesNotMatch(i, /ликвидатор/);
});

test('без кода, у действующей и при реорганизации — строки нет (как раньше)', () => {
  for (const [st, kod] of [['LIQUIDATING', undefined], ['ACTIVE', undefined], ['REORGANIZING', '124'], ['LIQUIDATED', undefined]]) {
    assert.strictEqual(fakt(P.sobrat(otvet(st, kod), { usloviya: U }), 'predel', 'Что сделать'), undefined, st + ' ' + kod);
  }
});

test('бесплатный Паспорт: строка остаётся (раздел «Предел аванса» — бесплатный); версия v2.13', () => {
  const p = P.sobrat(otvet('LIQUIDATING', '101'), { usloviya: U, dostup: 'free' });
  assert.ok(fakt(p, 'predel', 'Что сделать'));
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'js/pasport-kontragenta.js'), 'utf8'), /var VERSIYA = 'Паспорт v2\.13'/);
});

test('в status-kod.js нет сырых неразрывных пробелов в новых текстах (патч переносится текстом)', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'js/status-kod.js'), 'utf8');
  const blok = s.slice(s.indexOf('var KREDITORU'), s.indexOf('function kreditoru'));
  assert.ok(!blok.includes(' '));
});
