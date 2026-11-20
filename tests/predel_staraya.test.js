// predel-staraya-v1 [Ночные-2] 20.11 — слова юристов 19.11 вечер, разд. 1:
// (2) выручка старше двух лет — числа предела не даём: «Предел не считаем: последняя выручка в открытой отчётности — за {год}.
//     До свежей отчётности — по факту поставки.» — в «Условиях сделки», Паспорте, «Четырёх вопросах», сравнении;
// (5) долг по налогам меньше 500 ₽ — не причина вывода и не замечание (живой /api/check 1207007950 20.11: «задолженность по
//     налогам: 8 ₽» резала предел вдвое и стояла причиной); под выводом — справочная строка юристов дословно.
// Компании ниже вымышленные; форма ответа — живой /api/check (20.11). node --test tests/predel_staraya.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');
const P = require('../js/pasport-kontragenta.js');
const IV = require('../js/indeks-vorota.js');
const nb = (x) => String(x).replace(/[\u00a0\u202f\u2060]/g, ' ');

const BLOK = (s) => ({ nazvanie: 'реестр', status: 'polucheno', sostoyanie: s, data_svedeniy: '2026-11-20T09:15+03:00' });
function otvet(o) {
  o = o || {};
  const nal = o.nalog == null ? null : o.nalog;
  return {
    checked_at: '2026-11-20T10:00:00+03:00', risk_level: 'low',
    verdict: nal ? 'Работать можно. Есть один момент: задолженность по налогам. Уточните его перед крупной оплатой.' : 'Работать можно. Серьёзных признаков риска не найдено.',
    company: { inn: '7700000003', kind: 'LEGAL', name_short: 'ООО «Образец»', status: 'ACTIVE', reg_date: '2004-03-11' },
    signals: [nal
      ? { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: nal.toLocaleString('ru-RU') + ' ₽ (недоимка, пени и штрафы)', source: 'ФНС, открытые данные', as_of: '2026-10-01' }
      : { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '2026-10-01' }],
    dengi: { sostavlyayushchie: nal ? [{ vid: 'nedoimka', summa: nal, data_nabora: '2026-10-01' }] : [] },
    dossier: { kpi: [{ label: 'Выручка за ' + (o.god || 2025), value: 2600000000 }] },
    damia: { sudy: BLOK('not_found'), fssp: BLOK('not_found'), bankrotstvo: BLOK('not_found'), priostanovki: BLOK('not_found'), mery: BLOK('not_found'), polnota: { provereno: 7, iz: 7 } }
  };
}

test('(5) налог 8 ₽ — не причина вывода: тон, предел и причины — как без долга; справка КНД 1120101 — в «Что запросить»', () => {
  const chisto = U.decide(otvet(), { amount: 500000 }), v = U.decide(otvet({ nalog: 8 }), { amount: 500000 });
  assert.strictEqual(v.tone, 'go');
  assert.deepStrictEqual(v.reasons, []);
  assert.strictEqual(v.cap, chisto.cap, 'предел не режем вдвое');
  assert.strictEqual(nb(v.headline), nb(chisto.headline));
  assert.ok(v.docs.some((d) => d.id === 'taxCert'), 'уточнить, погашен ли, — справкой');
  assert.deepStrictEqual(v.facts.nalogOstatok, { summa: 8, data: '2026-10-01' });
  assert.ok(!Object.keys(v.facts).includes('nalogOstatok'), 'поле неперечисляемое — снимки JSON прежние');
});

test('(5) порог: 499 ₽ — остаток, 500 ₽ и 5 689 ₽ — замечание, как раньше', () => {
  assert.strictEqual(U.decide(otvet({ nalog: 499 })).tone, 'go');
  for (const s of [500, 5689]) {
    const v = U.decide(otvet({ nalog: s }));
    assert.strictEqual(v.tone, 'cap', String(s));
    assert.match(nb(v.reasons[0]), /^задолженность по налогам/, String(s));
  }
});

test('(5) под выводом — строка юристов вместо «Есть один момент: задолженность по налогам»', () => {
  const v = U.decide(otvet({ nalog: 8 }));
  const baza = 'Есть один момент: задолженность по налогам. Уточните его перед крупной оплатой';
  assert.strictEqual(nb(U.bezOstatka(v.facts, baza)), 'Долг по налогам — 8 ₽ на 01.10.2026 (ФНС). Небольшая сумма — уточните у компании, погашена ли');
  const v2 = U.decide(otvet({ nalog: 5689 }));
  assert.strictEqual(U.bezOstatka(v2.facts, baza), baza, 'от 500 ₽ — текст сервера прежний');
  assert.strictEqual(U.bezOstatka(v.facts, 'Серьёзных признаков риска не найдено'), 'Серьёзных признаков риска не найдено');
});

test('(2) Паспорт: выручка за 2021 — «не считаем: …», без суммы', () => {
  const p = P.sobrat(otvet({ god: 2021 }), { usloviya: U, indeksVorota: IV, summa: 500000 });
  const f = p.razdely.find((x) => x.id === 'predel').fakty.find((x) => x.tekst === 'Предел аванса');
  assert.strictEqual(nb(f.znachenie), 'не считаем: последняя выручка в открытой отчётности — за 2021. До свежей отчётности — по факту поставки.');
  assert.strictEqual(f.ton, 'warn');
  assert.strictEqual(p.itog.predel_avansa_rub, null);
  assert.strictEqual(p.itog.predel_sostoyanie, 'staraya');
});

test('(2) версия правила предела обновлена — сохранённые выводы различимы', () => {
  assert.strictEqual(U.METODIKA.PRAVILO, 'usloviya-2026-11-20');
  assert.strictEqual(U.decide(otvet()).predel.pravilo, 'usloviya-2026-11-20');
});
