// «Не проверяли» на экране проверки — один раз: вывод «Условий сделки» называет суды, банкротство и приставов,
// строка под «Существенными фактами» их не повторяет — «Кроме того, …» об остальных (комплект ne-povtor-v1, [Ночные-3] 11.10).
// node --test tests/ne_povtor.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const U = require('../js/usloviya.js');
const S = require('../js/sushchestvennoe.js');

// Форма живого ответа /api/check 11.10.2026 (damia-v1.4); компания вымышленная
function blok(sost, status) { return { nazvanie: 'x', status: status || 'ne_provereno', sostoyanie: sost, prichina: 'эти реестры мы пока не проверяем', proverit_samim: 'https://example.org/' }; }
function otvet(damia, o) {
  return Object.assign({
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО «ПРИМЕР»', status: 'ACTIVE', reg_date: '2000-09-05',
      okved: '47.91', director_since: '2020-02-08', invalid: false, address_invalid: false },
    risk_level: 'low', verdict: 'Работать можно. Серьёзных признаков риска не найдено.',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', as_of: null }],
    checked_at: '2026-10-11T07:23:00Z', damia: damia,
    dossier: { kpi: [{ label: 'Долг перед бюджетом', value: null, text: 'Нет' }], charts: {}, sections: [] }
  }, o || {});
}
const SEM = ['sudy', 'bankrotstvo', 'fssp', 'priostanovki', 'mery', 'rnp', 'kontrakty'];
function vse(sost) { const d = { versiya: 'damia-v1.4' }; SEM.forEach(k => { d[k] = blok(sost); }); return d; }
function strokaNe(h) { const m = /<p class="sut__ne">([^<]*)<\/p>/.exec(h); return m ? m[1] : ''; }

test('вывод называет три реестра — vVyvode отдаёт их ключи', () => {
  assert.deepStrictEqual(U.vVyvode(otvet(vse('not_checked'))), ['sudy', 'bankrotstvo', 'fssp']);
});

test('строка под фактами не повторяет вывод: «Кроме того, не проверяли: приостановки…»', () => {
  const r = otvet(vse('not_checked'));
  const t = strokaNe(S.html(r, { uzhe: U.vVyvode(r) }));
  assert.match(t, /^Кроме того, не проверяли: приостановки счетов, обеспечительные меры ФНС, РНП, госконтракты/);
  assert.doesNotMatch(t, /арбитражные суды|банкротство|приставы/);
  assert.match(t, /Не проверено — не значит «не обнаружено»/);
});

test('без подсказки — строка прежняя, полный список (Щит, старые вызовы)', () => {
  const t = strokaNe(S.html(otvet(vse('not_checked'))));
  assert.match(t, /^Не проверяли: арбитражные суды, банкротство, приставы, приостановки/);
});

test('в выводе есть причины (риск) — строки «Не проверяли» в выводе нет, список под фактами полный', () => {
  const r = otvet(vse('not_checked'), { company: Object.assign({}, otvet({}).company, { status: 'LIQUIDATED' }), risk_level: 'high', verdict: 'Не работать.' });
  assert.deepStrictEqual(U.vVyvode(r), []);
});

test('все проверены — vVyvode пустой', () => {
  const d = vse('not_checked');
  ['sudy', 'bankrotstvo', 'fssp'].forEach(k => { d[k] = { status: 'not_found', sostoyanie: 'checked' }; });
  // sostoyanie задан, но не not_checked — реестр ответил
  assert.deepStrictEqual(U.vVyvode(otvet(d)), []);
});

test('названы все — строки под фактами нет', () => {
  const d = { versiya: 'damia-v1.4' };
  ['sudy', 'bankrotstvo', 'fssp'].forEach(k => { d[k] = blok('not_checked'); });
  const r = otvet(d);
  assert.strictEqual(strokaNe(S.html(r, { uzhe: U.vVyvode(r) })), '');
});

test('главная передаёт подсказку из Usloviya.vVyvode в Sushchestvennoe.mount', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(h, /Sushchestvennoe\.mount\(report\.querySelector\('\.rows'\),r,\{uzhe:window\.Usloviya&&Usloviya\.vVyvode\?Usloviya\.vVyvode\(r\):\[\]\}\)/);
});
