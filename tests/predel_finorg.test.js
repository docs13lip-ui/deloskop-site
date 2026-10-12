// predel-finorg-v1 [Ночные запуски] 12.10 — ТЗ [команда] 12.10 (claude/Продукт_путь_покупки_живое_✎_12.10.md, разд. 2, пп. 5–6):
// банк (ОКВЭД 64.1x) или страховая организация (65.1x, 65.2x) — предел предоплаты не считаем, вместо числа — Банк России;
// строка «Старта» под кнопкой Паспорта; кабинет не пишет «из 1000» под слежением. Запуск: node --test tests/predel_finorg.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');
const P = require('../js/pasport-cta.js');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const TEKST = 'Для банков и страховых организаций предел предоплаты не считаем: за их устойчивостью следит Банк России.';
function resp(c, o) {
  return Object.assign({ checked_at: '2026-10-12', risk_level: 'low', signals: [],
    company: Object.assign({ inn: '7707083893', ogrn: '1027700132195', kind: 'LEGAL', name_short: 'ПАО «Банк»', status: 'ACTIVE', reg_date: '1991-06-20', okved: '64.19' }, c || {}) }, o || {});
}

test('банк 64.19 и страховая 65.12 / 65.20: числа нет, текст ТЗ и ссылка на Банк России по ОГРН', () => {
  for (const ok of ['64.19', '64.1', '64.11', '65.12', '65.20', '65.1']) {
    const v = U.decide(resp({ okved: ok }), { amount: 5000000 });
    assert.strictEqual(v.cap, null, ok);
    assert.strictEqual(v.finorg, true, ok);
    assert.strictEqual(v.kak.kak, TEKST, ok);
    assert.deepStrictEqual(v.kak.ssylka, { t: 'Лицензию и отчётность — на сайте Банка России', u: 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027700132195' });
    assert.strictEqual(v.prepay, '', ok);
    assert.doesNotMatch(v.headline, /\d/, ok);
    assert.doesNotMatch(v.advice, /предел/i, ok);
    assert.ok(!v.docs.some((d) => d.id === 'poruchitel'), ok);
  }
});

test('и с выручкой в отчётности — тоже без числа', () => {
  const v = U.decide(resp({}, { dossier: { kpi: [{ label: 'Выручка', value: 52e9 }] } }));
  assert.strictEqual(v.cap, null);
  assert.strictEqual(v.kak.kak, TEKST);
});

test('«Они платят мне»: «предел отсрочки», без общей строки о пределе', () => {
  const v = U.decide(resp(), { napravlenie: 'otgruzhaem', amount: 1e6 });
  assert.strictEqual(v.kak.kak, 'Для банков и страховых организаций предел отсрочки не считаем: за их устойчивостью следит Банк России.');
  assert.strictEqual(v.prepay, '');
  assert.ok(v.docs.some((d) => d.id === 'otchetnostBank'));
});

test('не банк и не страховая: 64.92 (МФО), 65.30 (НПФ), 46.90, ИП — предел считается как раньше', () => {
  for (const ok of ['64.92', '65.30', '46.90', '66.12']) assert.strictEqual(U.decide(resp({ okved: ok })).cap, 3000000, ok);
  assert.ok(!('finorg' in U.decide(resp({ inn: '770000000000', kind: 'INDIVIDUAL' }))));
});

test('ликвидированный или «стоп» банк — прежний запрет, не «не считаем»', () => {
  const v = U.decide(resp({ status: 'LIQUIDATED' }));
  assert.strictEqual(v.cap, 0);
  assert.notStrictEqual(v.kak.kak, TEKST);
});

test('отрисовка: пустой совет по сумме не рисует пустую строку', () => {
  const u = chitat('js/usloviya.js');
  assert.match(u, /v\.amount && \(v\.prepay \|\| stake\)/);
});

test('Паспорт контрагента: «Предел аванса — не считаем»', () => {
  const p = chitat('js/pasport-kontragenta.js');
  assert.match(p, /if \(u\.finorg\) fakt\('predel', 'Предел аванса', 'не считаем — банк или страховая организация'/);
});

test('п. 6: строка «Старта» — цены из tarify.json, «дешевле» только когда «Старт» в месяц дешевле Паспорта', () => {
  const D = JSON.parse(chitat('tarify/tarify.json'));
  const T = Object.assign(P.iz(D), { beta: false });
  const s = P.sostoyanie({ tarify: T, user: null, inn: '7707083893' });
  if (T.startMes < T.cena) {
    assert.strictEqual(s.ssylka.t, 'или «' + T.start + '» — ' + P.rub(T.startMes) + ' в месяц: дешевле одного Паспорта, и ' + P.pasportov(T.startPasportov));
  } else assert.ok(!/дешевле/.test((s.ssylka || {}).t || ''));
  const dorozhe = Object.assign({}, T, { startMes: T.cena + 10 });
  const s2 = P.sostoyanie({ tarify: dorozhe, user: null, inn: '7707083893' });
  assert.ok(!/дешевле/.test((s2.ssylka || {}).t || ''));
});

test('кабинет: «из N» под слежением — только при числе из тарифов (не больше максимума в tarify.json)', () => {
  const D = JSON.parse(chitat('tarify/tarify.json'));
  const max = Math.max.apply(null, D.tarify.map((t) => t.slezhenie || 0));
  const c = chitat('cabinet.html');
  const m = /var SLEZH_MAX=(\d+);/.exec(c);
  assert.ok(m, 'SLEZH_MAX в cabinet.html');
  assert.strictEqual(+m[1], max);
  assert.match(c, /j\.limit>0&&j\.limit<=SLEZH_MAX\?' из '\+j\.limit:''/);
  assert.doesNotMatch(c, /' из '\+\(j\.limit\|\|1\)/);
});
