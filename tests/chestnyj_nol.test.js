// chestnyj-nol-v1 (13.11.2026): суды и приставы сегодня не ответили — положительного вывода нет нигде в отчёте.
// Тексты — [команда] 13.11 12:40 п. 1.1–1.7 дословно. node --test tests/chestnyj_nol.test.js
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/usloviya.js');
const IO = require('../js/indeks-otvet.js');
const O = require('../js/otchet.js');
const D = require('../js/dengi-na-konu.js');
const NB = ' ';

// Форма живого ответа /api/check 13.11 (istochniki-v1): блок есть, sostoyanie = not_checked, причина — запас дня; компания вымышленная
function ne(nazv) {
  return { nazvanie: nazv, status: 'ne_provereno', sostoyanie: 'not_checked',
    prichina: 'сегодняшний запас проверок по этому источнику распределён — обновите отчёт завтра' };
}
function otvet(over) {
  return Object.assign({
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО «ПРИМЕР»', status: 'ACTIVE', reg_date: '2012-03-10',
      okved: '46.19', invalid: false, address_invalid: false },
    risk_level: 'low', verdict: 'Работать можно. Серьёзных признаков риска не найдено.', checked_at: '2026-11-13T09:30:00Z',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'age', title: 'Возраст компании', status: 'ok', detail: 'С 10.03.2012', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.11.2026' },
    ],
    damia: { sudy: ne('Арбитражные суды'), fssp: ne('Приставы'), bankrotstvo: { status: 'polucheno', sostoyanie: 'not_found' } },
    dengi: { sostavlyayushchie: [{ vid: 'nedoimka', summa: 0, data_nabora: '2026-11-01' }], ne_uchteno: ['iski_otvetchik', 'fssp_ostatok'],
      vyruchka: { summa: 52e6, god: 2025 } },
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 52e6 }], charts: { revenue: [{ year: 2024, value: 48e6 }, { year: 2025, value: 52e6 }] } },
  }, over || {});
}
const ZAPRET = /не нашли|без серьёзных|серьёзного не|серьёзных сигналов нет|чисто|Работать можно/i;

test('п. 1.1: вывод — «Проверили не всё: суды и приставы сегодня не ответили» + «Вывода о рисках пока нет.»', () => {
  const v = U.decide(otvet(), {});
  assert.strictEqual(v.headline, 'Проверили не всё: суды и приставы сегодня не' + NB + 'ответили');
  assert.ok(v.advice.startsWith('Вывода о рисках пока нет. '), v.advice);
  assert.doesNotMatch(v.headline + ' ' + v.advice, ZAPRET);
  // направление «Они платят мне» — те же слова
  const o = U.decide(otvet(), { napravlenie: 'otgruzhaem' });
  assert.strictEqual(o.headline, v.headline);
  // ответил один из двух — называем только другой
  const r = otvet(); r.damia.fssp = { status: 'polucheno', sostoyanie: 'not_found' };
  assert.strictEqual(U.decide(r, {}).headline, 'Проверили не всё: суды сегодня не' + NB + 'ответили');
});

test('п. 1.2, 1.7: Индекс — без числа и уровня при любой полноте; «Проверено N из M источников»', () => {
  const v = IO.vid(otvet());
  assert.strictEqual(v.rezhim, 'sokr');
  assert.strictEqual(v.neSF, 'суды и приставы');
  assert.ok(v.polnota >= 60, 'полнота выше порога — число всё равно не показываем: ' + v.polnota);
  assert.strictEqual(v.ball, undefined);
  assert.strictEqual(v.uroven, undefined);
  const h = IO.htmlKolonka(v);
  assert.ok(h.includes('Индекс — мало сведений для' + NB + 'расчёта'), h);
  assert.ok(h.includes('проверено ' + v.istochnikov + NB + 'из' + NB + v.vsego + ' источников'), h);
  assert.ok(!/полнота/.test(h), 'один счёт источников, без «полноты %» (п. 1.6)');
  assert.ok(IO.txtSokr(v).includes('Проверено ' + v.istochnikov + NB + 'из' + NB + v.vsego + ' источников'), 'Паспорт: причина целиком');
  assert.ok(!/ot-ix__big/.test(h));
  assert.doesNotMatch(h.replace(/<[^>]+>/g, ' '), ZAPRET);
  assert.strictEqual(IO.ball(otvet()), null);
  // суды и приставы ответили — число на месте (поведение прежнее)
  const r = otvet(); r.damia.sudy = { status: 'polucheno', sostoyanie: 'not_found' }; r.damia.fssp = { status: 'polucheno', sostoyanie: 'not_found' };
  assert.strictEqual(IO.vid(r).rezhim, 'chislo');
});

test('пилюля и полоса вывода: «Проверили не всё», без зелёного тона', () => {
  const r = otvet(), p = O.pilyulya(r, IO.vid(r));
  assert.strictEqual(p.t, 'Проверили не всё');
  assert.strictEqual(p.pod, 'Суды и' + NB + 'приставы сегодня не' + NB + 'ответили. Вывода о' + NB + 'рисках пока нет.');
  assert.strictEqual(O.tonPolosy(r), 'warn');
  const ok = otvet(); ok.damia.sudy = { status: 'polucheno', sostoyanie: 'not_found' }; ok.damia.fssp = { status: 'polucheno', sostoyanie: 'not_found' };
  assert.strictEqual(O.tonPolosy(ok), 'ok');
});

test('п. 1.3: «Деньги на кону» — «Не посчитали», без «0 ₽» и «не нашли»; недоимка — «Недоимки нет (ФНС, на дату)»', () => {
  const o = D.raschet(otvet(), new Date('2026-11-13T12:00:00+03:00'));
  assert.strictEqual(o.porog, 'ne_poschitali');
  const t = D.html(o).replace(/<[^>]+>/g, ' ');
  assert.ok(t.includes('Не посчитали'));
  assert.ok(t.includes('Иски и' + NB + 'долги у' + NB + 'приставов сегодня не' + NB + 'проверили — без них сумма неполная. Недоимки нет (ФНС, на 01.11.2026).'), t);
  assert.ok(!/0 ₽/.test(t), t);
  assert.doesNotMatch(t, ZAPRET);
});
