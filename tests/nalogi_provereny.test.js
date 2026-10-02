// Строка «Задолженность по налогам» (tax_debt, открытые данные ФНС) — ответ источника ([Право] 02.10 07:15/08:20).
// ok/warn/bad = налоги проверены; текст — «Нет в списке ФНС на [дата]»; набор старше 3 месяцев или без даты — «не проверяли»;
// «вдвое меньше: долги не проверены» (dolgiVse) — только если не проверены оба источника. Запуск: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('assert');
const U = require('../js/usloviya.js');
const S = require('../js/sushchestvennoe.js');
const NB = '\u00a0';

function nalog(status, asOf, detail) {
  return { id: 'tax_debt', title: 'Задолженность по налогам', status: status, detail: detail == null ? 'Нет' : detail, source: 'ФНС, открытые данные', as_of: asOf };
}
function resp(signals, checked) {
  return { checked_at: checked || '2026-10-02T06:00:00Z', risk_level: 'low',
    company: { inn: '7736050003', kind: 'LEGAL', name_short: 'ПАО «Газпром»', status: 'ACTIVE', reg_date: '1993-02-25' }, signals: signals };
}

test('налоги: свежий набор ФНС (ok) — проверены, в «Не проверяли» только приставы', () => {
  const r = resp([nalog('ok', '01.09.2026')]);
  const np = U.neProvereno(r, U.facts(r));
  assert.deepStrictEqual(np.spisok, ['долги у приставов']);
  assert.strictEqual(np.dolgiVse, false, 'один источник ответил — не «вдвое меньше»');
  assert.strictEqual(np.nalogiNa, '01.09.2026');
});

test('налоги: текст условий — «нет в списке ФНС на [дата]», не «нет»', () => {
  const v = U.decide(resp([nalog('ok', '01.09.2026')]), 500000);
  const ne = v.kak ? v.kak.ne : U.kakPoschitali(v.facts, v.tone, { raschet: v.raschet }, [], v.neProvereno).ne;
  assert.match(ne, /^Не проверяли: долги у приставов\./);
  assert.ok(ne.indexOf('Долги по налогам — нет в списке ФНС на' + NB + '01.09.2026.') >= 0, ne);
  assert.ok(!/долги по налогам\./.test(ne));
});

test('налоги: набор старше 3 месяцев — «не проверяли», с датой набора; оба не проверены → dolgiVse', () => {
  const r = resp([nalog('ok', '01.06.2026')]);
  const np = U.neProvereno(r, U.facts(r));
  assert.strictEqual(np.spisok.length, 2);
  assert.strictEqual(np.spisok[1], 'долги по налогам (набор ФНС на' + NB + '01.06.2026 старше 3' + NB + 'месяцев)');
  assert.strictEqual(np.dolgiVse, true);
  assert.strictEqual(np.nalogiNa, null);
});

test('налоги: граница 3 месяцев — день в день ещё свежий, на следующий — нет', () => {
  const r1 = resp([nalog('ok', '01.09.2026')], '2026-12-01T09:00:00Z');
  assert.deepStrictEqual(U.neProvereno(r1, U.facts(r1)).spisok, ['долги у приставов']);
  const r2 = resp([nalog('ok', '01.09.2026')], '2026-12-02T09:00:00Z');
  assert.strictEqual(U.neProvereno(r2, U.facts(r2)).spisok.length, 2);
  const f1 = S.fakty(r1).spisok.find((x) => x.k === 'tax_debt');
  const f2 = S.fakty(r2).spisok.find((x) => x.k === 'tax_debt');
  assert.strictEqual(f1.znach, 'Нет в списке ФНС на' + NB + '01.09.2026');
  assert.match(f2.znach, /^Не проверяли — набор ФНС на/);
});

test('налоги: без даты набора — «не проверяли»', () => {
  const r = resp([nalog('ok', null)]);
  assert.strictEqual(U.neProvereno(r, U.facts(r)).spisok.length, 2);
  const f = S.fakty(r).spisok.find((x) => x.k === 'tax_debt');
  assert.strictEqual(f.znach, 'Не проверяли — нет даты набора ФНС');
  assert.strictEqual(f.ton, 'neutral');
});

test('налоги: долг найден (bad) — источник видели, «нет в списке» не пишем', () => {
  const r = resp([nalog('bad', '01.09.2026', '1,2 млн ₽')]);
  const np = U.neProvereno(r, U.facts(r));
  assert.deepStrictEqual(np.spisok, ['долги у приставов']);
  assert.strictEqual(np.nalogiNa, null);
  const f = S.fakty(r).spisok.find((x) => x.k === 'tax_debt');
  assert.strictEqual(f.znach, '1,2 млн ₽');
  assert.strictEqual(f.ton, 'bad');
});

test('налоги: строки нет, источник не ответил (status neutral) — по-прежнему оба не проверены', () => {
  for (const sigs of [[], [nalog('neutral', '01.09.2026', 'Нет данных')]]) {
    const r = resp(sigs);
    const np = U.neProvereno(r, U.facts(r));
    assert.deepStrictEqual(np.spisok, ['долги у приставов', 'долги по налогам']);
    assert.strictEqual(np.dolgiVse, true);
  }
});

test('налоги: ответ DaMIA по налогам главнее строки ФНС', () => {
  const r = resp([nalog('ok', '01.01.2026')]);
  r.damia = { nalogi: { status: 'not_found' } };
  assert.deepStrictEqual(U.neProvereno(r, U.facts(r)).spisok, ['долги у приставов']);
});
