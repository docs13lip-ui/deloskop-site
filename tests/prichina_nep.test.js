// Причина «не проверяли» у внешних реестров (суды, банкротство, приставы, …) — без обещаний «завтра» и «в платном тарифе»
// (комплект prichina-nep-v1, [Ночные-3] 11.10). Найдено на живых ответах /api/check 11.10.2026: блоки damia с
// sostoyanie = not_checked приходят с текстом лимита («сегодня источник недоступен для новых проверок — обновите отчёт завтра»,
// «…или откройте его в платном тарифе»), а экран писал «Не проверяли: … — …обновите отчёт завтра или откройте его в платном тарифе».
// Ни один тариф суды, банкротство и приставов не включает; на главной — «пока не проверяем».
// node --test tests/prichina_nep.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/sushchestvennoe.js');
const O = require('../js/otkuda.js');

const ZAPAS = 'сегодняшний запас проверок по этому источнику распределён — обновите отчёт завтра или откройте его в платном тарифе';
const ZAVTRA = 'сегодня источник недоступен для новых проверок — обновите отчёт завтра';
const SEM = [['sudy', 'Арбитражные суды'], ['bankrotstvo', 'Банкротство'], ['fssp', 'Приставы'], ['priostanovki', 'Приостановки'],
  ['mery', 'Обеспечительные меры ФНС'], ['rnp', 'РНП'], ['kontrakty', 'Госконтракты']];
function damia(prichina, sost) {
  const d = { versiya: 'damia-v1.4', polnota: { provereno: 0, iz: 7 } };
  SEM.forEach(([k, n]) => { d[k] = { nazvanie: n, status: 'ne_provereno', sostoyanie: sost, prichina, proverit_samim: 'https://example.org/' + k, istochnik: 'DaMIA' }; });
  return d;
}
// Форма живого ответа /api/check 11.10.2026 (damia-v1.4); компания вымышленная
function otvet(dm) {
  return {
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО «ПРИМЕР»', status: 'ACTIVE', reg_date: '2000-09-05', okved: '47.91', director_since: '2020-02-08', invalid: false, address_invalid: false },
    risk_level: 'low', risk_title: 'Низкий риск', verdict: 'Работать можно. Серьёзных признаков риска не найдено.', checked_at: '2026-10-11T12:23:00Z',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' }],
    damia: dm,
    dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на 11.10.2026; задолженность — на 01.09.2026', kpi: [{ label: 'Долг перед бюджетом', value: null, text: 'Нет' }], charts: {}, sections: [] }
  };
}
const bezNb = (h) => String(h).replace(/ /g, ' ');
function strokaNe(h) { const m = /<p class="sut__ne">([^<]*)<\/p>/.exec(bezNb(h)); return m ? m[1] : ''; }

test('лимит API с «платным тарифом» у не запрошенных — «эти реестры мы пока не проверяем», без «завтра» и «тарифа»', () => {
  for (const pr of [ZAPAS, ZAVTRA, 'источник временно недоступен']) {
    const h = S.html(otvet(damia(pr, 'not_checked')));
    const t = strokaNe(h);
    assert.match(t, /^Не проверяли: арбитражные суды, банкротство, приставы, [^<]* — эти реестры мы пока не проверяем\. Не проверено — не значит «не обнаружено»/, pr);
    assert.doesNotMatch(bezNb(h), /тариф|завтра|запас проверок|временно/i, pr);
  }
});

test('подсказка ne-povtor («Кроме того, …») — та же причина', () => {
  const r = otvet(damia(ZAPAS, 'not_checked'));
  const t = strokaNe(S.html(r, { uzhe: ['sudy', 'bankrotstvo', 'fssp'] }));
  assert.strictEqual(t.split('. Не проверено')[0], 'Кроме того, не проверяли: приостановки счетов, обеспечительные меры ФНС, РНП, госконтракты — эти реестры мы пока не проверяем');
});

test('причина без обещания — как прислал API', () => {
  const t = strokaNe(S.html(otvet(damia('в открытой бете не подключён', 'not_checked'))));
  assert.match(t, / — в открытой бете не подключён\./);
});

test('сбой (не not_checked): «Не ответили в этот раз», «завтра» остаётся, «платный тариф» — нет', () => {
  assert.strictEqual(S.prichinaReestra({ status: 'oshibka', prichina: ZAPAS }), 'сегодняшний запас проверок по этому источнику распределён — обновите отчёт завтра');
  const t = strokaNe(S.html(otvet(damia(ZAPAS, undefined))));
  assert.match(t, /^Не ответили в этот раз: [^<]* — сегодняшний запас проверок по этому источнику распределён — обновите отчёт завтра\./);
  assert.doesNotMatch(t, /тариф/);
});

test('«Все данные из реестров»: не запрошенный — «Не проверяли: эти реестры мы пока не проверяем», сбой — «Не ответили в этот раз: …»', () => {
  const g1 = S.glubina(otvet(damia(ZAPAS, 'not_checked'))).razdely;
  const r1 = g1.filter((x) => x.zag === 'Внешние реестры')[0].stroki;
  assert.strictEqual(r1.length, 7);
  r1.forEach((s) => assert.strictEqual(s[1], 'Не проверяли: эти реестры мы пока не проверяем'));
  const g2 = S.glubina(otvet(damia(ZAPAS, undefined))).razdely;
  g2.filter((x) => x.zag === 'Внешние реестры')[0].stroki.forEach((s) => assert.strictEqual(bezNb(s[1]), 'Не ответили в этот раз: сегодняшний запас проверок по этому источнику распределён — обновите отчёт завтра'));
});

test('«Откуда данные»: та же причина один раз, без «тарифа» и «завтра»', () => {
  const r = otvet(damia(ZAPAS, 'not_checked'));
  const o = O.istochniki(r);
  o.spisok.filter((x) => x.status === 'nep').forEach((x) => assert.strictEqual(x.prichina, 'эти реестры мы пока не проверяем'));
  const h = bezNb(O.html(r));
  assert.doesNotMatch(h, /тариф|завтра/i);
  assert.ok(h.includes('Не проверяли 7 реестров — мы их пока не проверяем.'), 'общая строка без повтора «не проверяли… не проверяем»');
  const o2 = O.istochniki(otvet(damia(ZAPAS, undefined)));
  o2.spisok.filter((x) => x.status === 'net').forEach((x) => assert.doesNotMatch(x.prichina, /тариф/));
});

test('правила одинаковые в sushchestvennoe.js и otkuda.js', () => {
  const vzyat = (f, imya) => { const m = new RegExp('var ' + imya + ' = ([^;]+);').exec(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')); return m && m[1]; };
  for (const imya of ['POKA_NE', 'OBESHCHANIE', 'PLATNYJ']) {
    assert.ok(vzyat('sushchestvennoe.js', imya), imya);
    assert.strictEqual(vzyat('otkuda.js', imya), vzyat('sushchestvennoe.js', imya), imya);
  }
});
