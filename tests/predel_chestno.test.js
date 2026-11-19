// predel-chestno-v1 (внешний аудит 19.11, п. 22 (г) «граничные случаи, Паспорт и отчёт = Условия сделки»):
// (1) предел из выручки старше двух лет — ориентир предварительный (ОАО «РЖД» 19.11: 75,5 млрд ₽ по выручке за 2021 год);
// (2) не ответили реестры, от которых зависит вывод о деньгах, — ни в Паспорте, ни в «Четырёх вопросах» отчёта,
//     ни в сравнении нет голого «до X»: те же слова, что в «Условиях сделки» (dostovernost-v1).
// node --test tests/predel_chestno.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');
const I = require('../js/istochniki.js');
const P = require('../js/pasport-kontragenta.js');
const IV = require('../js/indeks-vorota.js');
const Q = require('../js/chetyre-voprosa.js');
global.self = global; global.Usloviya = U; // сравнение берёт модуль из окна (self)
const S = require('../js/sravnenie.js');

const nb = (x) => String(x).replace(/ /g, ' ');
const BLOK = (s) => ({ nazvanie: 'реестр', status: s === 'not_checked' ? 'ne_provereno' : 'polucheno', sostoyanie: s, data_svedeniy: '2026-11-13T09:15+03:00' });
function otvet(o) {
  o = o || {};
  const r = {
    checked_at: '2026-11-19T10:00:00+03:00', risk_level: 'low',
    company: { inn: '7700000002', name_short: 'ООО «Образец»', status: 'ACTIVE', reg_date: '2003-09-18' },
    signals: [{ title: 'Задолженность по налогам', status: 'ok', detail: 'нет', source: 'ФНС, открытые данные', as_of: '01.10.2026' }],
    dossier: { kpi: [{ label: 'Выручка за ' + (o.god || 2025), value: 2600000000 }] },
    damia: { sudy: BLOK('not_found'), fssp: BLOK('not_found'), bankrotstvo: BLOK('not_found'), priostanovki: BLOK(o.prio || 'not_found'), mery: BLOK(o.mery || 'not_found'), polnota: { provereno: 7, iz: 7 } }
  };
  if (o.prio || o.mery) I.dopolnit(r); // как в браузере; «всё ответило» — без словаря (замороженный реестр «не найдено» не даёт)
  return r;
}

test('(1) выручка старше двух лет — «Предварительно», причина с годом, приостановки и меры не теряются', () => {
  const r = otvet({ god: 2021, prio: 'not_checked', mery: 'not_checked' });
  for (const napr of ['platim', 'otgruzhaem']) {
    const v = U.decide(r, { amount: 500000, napravlenie: napr });
    assert.strictEqual(v.predvaritelno && v.predvaritelno.baza, 'staraya', napr);
    assert.match(nb(v.headline), /^Предварительно/, napr);
    assert.match(nb(v.kak.ne), /последняя выручка в открытой отчётности — за 2021 год/, napr);
    assert.match(nb(v.kak.ne), /Не проверяли в этот раз: решения ФНС о приостановке операций по счетам, обеспечительные меры ФНС\./, napr);
    assert.ok(!('nepolno' in v), napr + ': заголовок — «Предварительно», не «по нашей оценке»');
  }
});

test('(1) граница: выручка за год проверки −2 — ориентир прежний; −3 — предварительный', () => {
  const v2 = U.decide(otvet({ god: 2024 }), { amount: 500000 });
  assert.ok(!v2.predvaritelno, 'за 2024 при проверке 2026 — не старая');
  const v3 = U.decide(otvet({ god: 2023 }), { amount: 500000 });
  assert.strictEqual(v3.predvaritelno && v3.predvaritelno.baza, 'staraya');
});

test('(1) свежая выручка и все реестры ответили — вывод побайтно прежний', () => {
  const v = U.decide(otvet({ god: 2025 }), { amount: 500000 });
  assert.ok(!v.predvaritelno && !('nepolno' in v));
  assert.strictEqual(nb(v.headline), 'Работать можно');
});

test('(2) Паспорт: неполная проверка — «по нашей оценке не больше», не зелёная голая сумма', () => {
  const r = otvet({ prio: 'not_checked', mery: 'not_checked' });
  const p = P.sobrat(r, { usloviya: U, indeksVorota: IV, summa: 500000 });
  const f = p.razdely.find((x) => x.id === 'predel').fakty.find((x) => x.tekst === 'Предел аванса');
  assert.match(nb(f.znachenie), /^по нашей оценке не больше \d[\d ]* ₽ — по проверенным источникам, это не гарантия исполнения договора$/);
  assert.strictEqual(f.ton, 'warn');
  const p2 = P.sobrat(otvet(), { usloviya: U, indeksVorota: IV, summa: 500000 });
  const f2 = p2.razdely.find((x) => x.id === 'predel').fakty.find((x) => x.tekst === 'Предел аванса');
  assert.match(nb(f2.znachenie), /^\d[\d ]* ₽$/, 'полная проверка — сумма, как раньше');
});

test('(2) «Четыре вопроса» отчёта: без «Предоплата — до X» при неполной и предварительной', () => {
  const a = Q.vyvod(otvet({ prio: 'not_checked', mery: 'not_checked' })).avans;
  assert.ok(!/Предоплата — до/.test(nb(a)), a);
  assert.match(nb(a), /по нашей оценке не больше .*не гарантия исполнения договора\. Не проверяли в этот раз: решения ФНС о приостановке/);
  const b = Q.vyvod(otvet({ god: 2021 })).avans;
  assert.match(nb(b), /^Предоплата — предварительно не больше /);
  assert.match(nb(Q.vyvod(otvet()).avans), /^Предоплата — до \d/, 'полная проверка — как раньше');
});

test('(2) сравнение: «Сколько платить вперёд» без «До X» при неполной и предварительной', () => {
  const st = (r) => S.stroki(r, otvet(), {}).find((x) => x.k === 'predoplata').a;
  assert.match(nb(st(otvet({ prio: 'not_checked', mery: 'not_checked' })).t), /^Не больше /);
  assert.match(nb(st(otvet({ god: 2021 })).t), /^Предварительно не больше /);
  assert.match(nb(st(otvet()).t), /^До /);
});
