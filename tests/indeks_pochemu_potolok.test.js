// [Ночные-3] indeks-pochemu-v1.1: «Что изменилось» — сдвиг Индекса не всегда равен сумме вкладов.
// Найдено проверкой экрана 11.10 (ответ API ПАО «НЛМК» + отметка о недостоверности адреса): «Индекс: 75 → 45»,
// а в «Почему» только «(−20)» — читатель не понимал, откуда ещё −10 (потолок методики 45).
// node --test tests/indeks_pochemu_potolok.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const IO = require('../js/indeks-otvet.js');
const M = require('../indeks/metodika-v1.json');
const NB = ' ';

// вымышленная компания, форма ответа — как в tests/indeks_pochemu.test.js
function otvet(over, company) {
  return Object.assign({
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', invalid: false, address_invalid: false }, company || {}),
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
const nedost = () => {
  const r = otvet({ checked_at: '2026-10-03T09:00:00Z' }, { address_invalid: true });
  r.signals = r.signals.map((x) => (x.id === 'address' ? Object.assign({}, x, { status: 'bad', detail: 'Сведения об адресе недостоверны' }) : x));
  return r;
};
const ixStroka = (izm) => izm.find((x) => /^Индекс: /.test(x.t));
const F = (id) => M.faktory.find((f) => f.id === id);

test('методика: у недостоверного адреса есть потолок — faktor() его отдаёт, shkala() — границы и предел плюсов', () => {
  assert.strictEqual(IO.faktor('nedostovernyj_adres').potolok, F('nedostovernyj_adres').potolok);
  assert.strictEqual(IO.faktor('vozrast_10g').potolok, undefined);
  assert.deepStrictEqual(IO.shkala(), { min: M.shkala.min, max: M.shkala.max, plyusyMaks: M.plyusy_maksimum });
});

test('появилась недостоверность: «75 → 45» объяснено вкладом и потолком методики', () => {
  const a = D.snimok(otvet()), b = D.snimok(nedost());
  const P = F('nedostovernyj_adres').potolok;
  assert.strictEqual(a.ix, 75);
  assert.strictEqual(b.ix, P, 'число упирается в потолок');
  assert.notStrictEqual(a.ix + F('nedostovernyj_adres').vklad, b.ix, 'без потолка вышло бы другое число — значит, пояснение нужно');
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual(x.t, 'Индекс: 75 → ' + P + ' с' + NB + 'проверки 30.09');
  assert.strictEqual(x.pod,
    'Почему: появилось — «ФНС отметила адрес как недостоверный»' + NB + '(−20). ' +
    'С' + NB + 'этим признаком Индекс не' + NB + 'выше ' + P + ' — потолок методики. ' +
    'Вклады — по' + NB + 'открытой методике v' + M.versiya + '.');
});

test('отметку сняли: «45 → 75» — ушёл вклад и потолок', () => {
  const a = D.snimok(nedost()); a.t = Date.parse('2026-09-30T09:00:00Z');
  const b = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  const x = ixStroka(D.sravnit(a, b));
  assert.strictEqual(x.ton, 'luchshe');
  assert.match(x.pod, /^Почему: ушло — «ФНС отметила адрес как недостоверный»\s\(\+20\)\. Потолок методики «не\sвыше 45» ушёл вместе с\sпризнаком\. Вклады/);
});

test('предел плюсов: сумма вкладов ≠ сдвигу — честная оговорка с числами из методики', () => {
  const plyusy = ['vozrast_10g', 'shtat_10', 'goskontrakty', 'licenzii', 'gospodderzhka', 'likvidnost_vysokaya'];
  const sum = (ids) => ids.reduce((s, id) => s + F(id).vklad, 0);
  assert.ok(sum(plyusy) > M.plyusy_maksimum, 'образец действительно упирается в предел плюсов');
  const a = D.snimok(otvet()), b = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  const bIds = plyusy.filter((id) => id !== 'goskontrakty' && id !== 'licenzii');
  a.ixf = plyusy.slice(); b.ixf = bIds;
  a.ix = M.shkala.baza + Math.min(sum(plyusy), M.plyusy_maksimum);
  b.ix = M.shkala.baza + Math.min(sum(bIds), M.plyusy_maksimum);
  assert.notStrictEqual(b.ix - a.ix, -(F('goskontrakty').vklad + F('licenzii').vklad));
  const x = ixStroka(D.sravnit(a, b));
  assert.match(x.pod, /^Почему: ушло — «[^»]+»\s\(−4\), «[^»]+»\s\(−2\)\. Итог не\sравен сумме вкладов: у\sплюсов есть предел \(не\sбольше \+12\), у\sчасти признаков — потолок, шкала — от\s1 до\s99\. Вклады/);
});

test('сумма сходится — оговорки нет; часть факторов скрыта — оговорки нет', () => {
  const a = D.snimok(otvet());
  const b = D.snimok(otvet({ checked_at: '2026-10-03T09:00:00Z' }));
  a.ixf = ['vozrast_10g']; b.ixf = ['vozrast_10g', 'massovyj_adres']; a.ix = 75; b.ix = 69;
  assert.doesNotMatch(ixStroka(D.sravnit(a, b)).pod, /Итог|Потолок/);
  b.ixf = ['massovyj_rukovoditel', 'massovyj_adres', 'shtat_0_1', 'ubytok_2_goda', 'vozrast_10g']; b.ix = 40;
  assert.doesNotMatch(ixStroka(D.sravnit(a, b)).pod, /Итог/);
});

test('вёрстка: пояснение внутри подстрочника, без обещаний', () => {
  const a = D.snimok(otvet()), b = D.snimok(nedost());
  const h = D.htmlIzmeneniya({ s: a, izm: D.sravnit(a, b) });
  assert.match(h, /<small class="izm__pod">Почему: [^<]*С\sэтим признаком Индекс не\sвыше 45 — потолок методики\./);
  assert.doesNotMatch(h, /надёжн|гарантир|безопасн/i);
});

test('появилось несколько признаков — потолок назван по имени', () => {
  const a = D.snimok(otvet());
  const r = nedost(); r.signals.push({ id: 'x', title: 'Массовый руководитель', detail: '12 компаний', status: 'warn', source: 'ЕГРЮЛ', as_of: null });
  const b = D.snimok(r);
  const x = ixStroka(D.sravnit(a, b));
  assert.match(x.pod, /При\sпризнаке «ФНС отметила адрес как недостоверный» Индекс не\sвыше 45 — потолок методики\./);
  assert.strictEqual(b.ix, 45);
});
