// dostovernost-v1 (внешний аудит 19.11, п. 22 (б), (в)): денежный вывод без «Можно», пока не проверены реестры,
// от которых зависит вывод о деньгах; наличные — предел по одному договору, а не запрет. node --test tests/dostovernost.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');
const L = require('../js/lestnica.js');
const I = require('../js/istochniki.js');

const nb = (x) => String(x).replace(/\u00a0/g, ' ');
const BLOK = (sostoyanie) => ({ nazvanie: 'реестр', status: sostoyanie === 'not_checked' ? 'ne_provereno' : 'polucheno', sostoyanie, data_svedeniy: '2026-11-13T09:15+03:00' });
// как живой ответ 19.11: суды, приставы, ЕФРСБ ответили; приостановки и обеспечительные меры ФНС — нет (источник заморожен)
function otvet(prio, mery, bezSlovarya) {
  const r = {
    checked_at: '2026-11-19T10:00:00+03:00', risk_level: 'low',
    company: { inn: '7700000002', name_short: 'ООО «Образец»', status: 'ACTIVE', reg_date: '2010-12-06' },
    signals: [{ title: 'Задолженность по налогам', status: 'warn', detail: '5 689 ₽', source: 'ФНС, открытые данные', as_of: '01.10.2026' }],
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 2600000000 }] },
    damia: { sudy: BLOK('not_found'), fssp: BLOK('not_found'), bankrotstvo: BLOK('not_found'), priostanovki: BLOK(prio), mery: BLOK(mery), polnota: { provereno: 5, iz: 7 } }
  };
  if (!bezSlovarya) I.dopolnit(r); // как в браузере: словарь API → словарь сайта (замороженный реестр «не найдено» не даёт)
  return r;
}

test('(б) приостановки и меры ФНС не проверены — в выводе нет «можно», предел — «по нашей оценке», «не гарантия»', () => {
  const r = otvet('not_checked', 'not_checked');
  for (const napr of ['platim', 'otgruzhaem']) {
    const v = U.decide(r, { amount: 500000, napravlenie: napr });
    assert.ok(v.nepolno && v.nepolno.length, napr + ': nepolno');
    assert.ok(!/можно/i.test(v.headline), napr + ': «' + v.headline + '»');
    assert.ok(!/допустим|обычные условия подойдут/.test(v.prepay), napr + ': ' + v.prepay);
    assert.match(nb(v.kak.ne), /^Не проверяли в этот раз: решения ФНС о приостановке операций по счетам, обеспечительные меры ФНС\./);
    assert.match(nb(v.kak.ne), /не гарантия/);
  }
  const v = U.decide(r, { amount: 500000 });
  if (v.tone === 'cap') assert.match(nb(v.headline), /^Предоплата — по нашей оценке не больше \d[\d ]* ₽$/);
  else assert.strictEqual(nb(v.headline), 'Серьёзных сигналов в проверенных источниках нет');
  assert.match(nb(v.prepay), /не гарантия исполнения договора/);
});

test('(б) все реестры, влияющие на вывод о деньгах, ответили — вывод прежний, поля nepolno нет', () => {
  const v = U.decide(otvet('not_found', 'not_found', true), { amount: 500000 });
  assert.ok(!('nepolno' in v));
  // pravo-sdelka-v1 (юристы 19.11 разд. 1 (а)): «Можно, предоплата — до X» не возвращаем и при полной проверке
  assert.match(nb(v.headline), /^(Предоплата — по нашей оценке не больше|Работать можно)/);
  if (v.tone === 'cap') assert.match(nb(v.kak.ne), /^Это расчёт по проверенным источникам( на [\d.]+)?, а не гарантия исполнения договора\.$/);
});

test('(б) ни при каком тоне и неполной проверке — ни одного «можно» в заголовке', () => {
  const r = otvet('not_checked', 'not_found');
  [0, 50000, 500000, 50000000].forEach((amount) => {
    ['platim', 'otgruzhaem'].forEach((napr) => {
      const v = U.decide(r, { amount, napravlenie: napr });
      if (v.tone === 'go' || v.tone === 'cap') assert.ok(!/можно/i.test(v.headline), amount + ' ' + napr + ': ' + v.headline);
    });
  });
});

test('(в) наличные: предел 100 000 ₽ по одному договору, не запрет; «Лестница» и «Условия сделки» — одной строкой', () => {
  assert.strictEqual(U.NALICHNYE, L.NALICHNYE);
  assert.ok(!/нельзя/.test(L.NALICHNYE));
  assert.match(L.NALICHNYE, /^Наличными — не больше 100 000 ₽ по одному договору, остальное — безналично/);
  assert.match(L.NALICHNYE, /п\. 4 Указания Банка России от 09\.12\.2019 № 5348‑У/);
});
