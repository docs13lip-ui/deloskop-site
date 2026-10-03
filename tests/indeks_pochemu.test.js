// [Ночные-3] indeks-pochemu-v1: «Что изменилось» объясняет сдвиг Индекса — какие факторы открытой методики появились и ушли
// (эталон экрана 02.10: «История Индекса — было 72 → стало 54, почему»). node --test tests/indeks_pochemu.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const IO = require('../js/indeks-otvet.js');
const M = require('../indeks/metodika-v1.json');
const NB = '\u00a0';

// вымышленная компания, форма ответа — как в tests/indeks_otvet.test.js
function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: '2026-09-30T09:00:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2015', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    dossier: { charts: { revenue: [{ year: 2024, value: 40e6 }, { year: 2025, value: 48.2e6 }], profit: [{ year: 2025, value: -1.5e6 }] } },
  }, over || {});
}
const s = (title, detail, status) => ({ id: 'x', title, detail, status, source: 'ЕГРЮЛ', as_of: null });
const plus = (r, ...x) => { r.signals = r.signals.concat(x); r.checked_at = '2026-10-03T09:00:00Z'; return r; };
const ixStroka = (izm) => izm.find((x) => /^Индекс: /.test(x.t));

test('снимок браузерного Индекса хранит id факторов, полноту и версию методики — без текста и сумм', () => {
  const a = D.snimok(otvet());
  assert.strictEqual(a.ix, 75);
  assert.deepStrictEqual(a.ixf, ['vozrast_10g']);
  assert.strictEqual(a.ixp, 75);
  assert.strictEqual(a.ixv, M.versiya);
  a.ixf.forEach((id) => assert.ok(M.faktory.some((f) => f.id === id), id));
});

test('хуже: «Индекс: 75 → 59» + почему — два новых фактора, крупный первым, вклады из методики', () => {
  const a = D.snimok(otvet());
  const b = D.snimok(plus(otvet(), s('Массовый руководитель', '12 компаний', 'warn'), s('Адрес', 'массовый адрес: 54 компании', 'warn')));
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual(x.ton, 'huzhe');
  assert.strictEqual(x.t, 'Индекс: 75 → 59 с' + NB + 'проверки 30.09');
  const f1 = IO.faktor('massovyj_rukovoditel'), f2 = IO.faktor('massovyj_adres');
  assert.ok(Math.abs(f1.vklad) >= Math.abs(f2.vklad));
  assert.strictEqual(x.pod, 'Почему: появилось — «Руководитель или учредитель — „массовый“»' + NB + '(' + '−' + Math.abs(f1.vklad) + '), ' +
    '«' + f2.tekst + '»' + NB + '(−' + Math.abs(f2.vklad) + '). Вклады — по' + NB + 'открытой методике v' + M.versiya + '.');
  // сумма вкладов в подстрочнике = разница чисел (без потолков и предела плюсов)
  assert.strictEqual(f1.vklad + f2.vklad, 59 - 75);
});

test('лучше: факторы ушли — знак вклада обратный («ушло … (+10)»)', () => {
  const a = D.snimok(plus(otvet(), s('Массовый руководитель', '12 компаний', 'warn')));
  a.t = Date.parse('2026-09-30T09:00:00Z');
  const b = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual(x.ton, 'luchshe');
  assert.match(x.pod, /^Почему: ушло — «Руководитель или учредитель — „массовый“»\s\(\+10\)\./);
});

test('не больше трёх факторов, остальное — «и ещё N»', () => {
  const a = D.snimok(otvet());
  const b = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  a.ixf = ['vozrast_10g']; b.ixf = ['massovyj_rukovoditel', 'massovyj_adres', 'shtat_0_1', 'ubytok_2_goda', 'vozrast_10g'];
  a.ix = 75; b.ix = 40;
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual((x.pod.match(/«[^»]*(„[^“]*“[^»]*)?»/g) || []).length, 3, x.pod);
  assert.match(x.pod, /; и\sещё 1\. Вклады/);
});

test('молчим, если разбора нет: серверное число, старый снимок без ixf', () => {
  const a = D.snimok(otvet({ indeks: 70, polnota: 80 }));
  const b = D.snimok(plus(otvet({ indeks: 55, polnota: 80 })));
  assert.strictEqual(a.ixf, undefined, 'у серверного числа факторов нет');
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual(x.t, 'Индекс: 70 → 55 с' + NB + 'проверки 30.09');
  assert.strictEqual(x.pod, undefined);
  const st = D.snimok(otvet()); delete st.ixf; delete st.ixp; delete st.ixv;
  const nov = D.snimok(plus(otvet(), s('Массовый руководитель', '12 компаний', 'warn')));
  assert.strictEqual(ixStroka(D.sravnit(st, nov)).pod, undefined);
});

test('методика сменилась — факторы не сравниваем и так и пишем; факторы те же — полнота', () => {
  const a = D.snimok(otvet()), b = D.snimok(plus(otvet(), s('Массовый руководитель', '12 компаний', 'warn')));
  a.ixv = '1.0'; b.ixv = '1.0.1';
  assert.strictEqual(ixStroka(D.sravnit(a, b)).pod, 'Методика Индекса обновилась: v1.0 → v1.0.1 — факторы двух проверок не' + NB + 'сравниваем.');
  const c = D.snimok(otvet()), e = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  c.ix = 75; e.ix = 69; e.ixp = 85;
  assert.strictEqual(ixStroka(D.sravnit(c, e)).pod, 'Факторы те' + NB + 'же — изменилась полнота данных: 75' + NB + '% → 85' + NB + '%.');
});

test('вёрстка: подстрочник экранирован и стоит под строкой Индекса; тексты без обещаний и «надёжн»', () => {
  const a = D.snimok(otvet()), b = D.snimok(plus(otvet(), s('Массовый руководитель', '12 компаний', 'warn')));
  const h = D.htmlIzmeneniya({ s: a, izm: D.sravnit(a, b) });
  assert.match(h, /<li class="izm--huzhe">Индекс: 75 → 65[^<]*<small class="izm__pod">Почему: появилось — «Руководитель или учредитель — „массовый“»/);
  assert.doesNotMatch(h, /надёжн|гарантир|безопасн/i);
  const bad = D.snimok(otvet()); bad.ixf = ['<img src=x>']; bad.ix = 10;
  assert.doesNotMatch(D.htmlIzmeneniya({ s: a, izm: D.sravnit(a, bad) }), /<img/);
});
