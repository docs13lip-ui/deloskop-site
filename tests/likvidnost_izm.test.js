// likvidnost-izm-v1 (Ночные-3, 03.10): текущая ликвидность и смена прибыли на убыток — в «Что изменилось с вашей проверки»
// (js/dinamika.js). Ликвидность — строка раздела досье dynamics (ГИР БО), год — charts.balance / charts.debts.
// node --test tests/likvidnost_izm.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const S = require('../js/sushchestvennoe.js');
const NB = '\u00a0';

function otvet(t, god, lk, over) {
  const sections = lk === undefined ? [] : [{ id: 'dynamics', title: 'Финансовая динамика', rows: [['Выручка', '5,8 трлн ₽'], ['Текущая ликвидность', lk]] }];
  return Object.assign({
    company: { inn: '7740000076', kind: 'LEGAL', status: 'ACTIVE', director_since: '2019-05-20', name_short: 'ПАО «Пример»' },
    risk_level: 'low', checked_at: t, signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' }], zsk: { level: 'low' },
    dossier: { sections, charts: { revenue: [{ year: god, value: 48e6 }], profit: [{ year: god, value: 2e6 }], balance: { year: god, equity: 9e6 } } },
  }, over || {});
}
const RAN = '2026-09-12T10:00:00Z', SEJ = '2026-10-03T03:30:00Z';
const lkIzm = (v) => v.filter((x) => /ликвидност|Оборотные средства/.test(x.t));

test('ликвидность в снимке: год и число с 2 знаками; ноль, пусто, мусор, без года и у ИП — нет', () => {
  assert.deepStrictEqual(D.snimok(otvet(SEJ, 2025, '0,2217')).lk, [2025, 0.22]);
  assert.deepStrictEqual(D.snimok(otvet(SEJ, 2025, '1.5')).lk, [2025, 1.5]);
  for (const v of ['0', '', null, 'нет данных', '—', '-0,5', undefined]) assert.ok(!('lk' in D.snimok(otvet(SEJ, 2025, v))), 'lk = ' + v);
  const bezGoda = otvet(SEJ, 2025, '0,8'); delete bezGoda.dossier.charts.balance;
  assert.ok(!('lk' in D.snimok(bezGoda)));
  const sDebts = otvet(SEJ, 2025, '0,8'); sDebts.dossier.charts = { debts: { year: 2024 } };
  assert.deepStrictEqual(D.snimok(sDebts).lk, [2024, 0.8], 'год — из charts.debts');
  const ip = otvet(SEJ, 2025, '0,5', { company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE' } });
  assert.ok(!('lk' in D.snimok(ip)));
});

test('тот же разбор, что у существенного факта «Текущая ликвидность»', () => {
  for (const v of ['0,22', '1,05', '3']) {
    const r = otvet(SEJ, 2025, v), a = S.likvidnost(r);
    assert.deepStrictEqual(D.likvidnost(r), [a.god, Math.round(a.znach * 100) / 100]);
  }
});

test('ниже 1 — «хуже» первым; снова 1 и выше — «лучше»; без перехода через 1 — молчим', () => {
  const v = D.sravnit(D.snimok(otvet(RAN, 2024, '1,4')), D.snimok(otvet(SEJ, 2025, '0,82')));
  assert.strictEqual(v[0].ton, 'huzhe');
  assert.strictEqual(v[0].t, 'Текущая ликвидность опустилась ниже 1: на' + NB + '31.12.2025 — 0,82, краткосрочные долги больше оборотных средств (ГИР' + NB + 'БО)');
  const l = lkIzm(D.sravnit(D.snimok(otvet(RAN, 2024, '0,6')), D.snimok(otvet(SEJ, 2025, '1'))));
  assert.deepStrictEqual(l, [{ ton: 'luchshe', t: 'Оборотные средства снова покрывают краткосрочные долги: текущая ликвидность на' + NB + '31.12.2025 — 1,00 (ГИР' + NB + 'БО)' }]);
  assert.deepStrictEqual(lkIzm(D.sravnit(D.snimok(otvet(RAN, 2025, '0,6')), D.snimok(otvet(SEJ, 2025, '0,3')))), [], '0,6 → 0,3');
  assert.deepStrictEqual(lkIzm(D.sravnit(D.snimok(otvet(RAN, 2025, '2')), D.snimok(otvet(SEJ, 2025, '1,2')))), [], '2 → 1,2');
  assert.deepStrictEqual(lkIzm(D.sravnit(D.snimok(otvet(RAN, 2025)), D.snimok(otvet(SEJ, 2025, '0,3')))), [], 'старый снимок без ликвидности');
  assert.deepStrictEqual(lkIzm(D.sravnit(D.snimok(otvet(RAN, 2025, '2')), D.snimok(otvet(SEJ, 2024, '0,3')))), [], 'баланс старше прошлого');
});

test('новая отчётность: прибыль → убыток — «хуже», убыток → прибыль — «лучше», прибыль → прибыль — справочно', () => {
  function sP(t, god, p) { const r = otvet(t, god); r.dossier.charts.profit = [{ year: god, value: p }]; return D.snimok(r); }
  const h = D.sravnit(sP(RAN, 2024, 3e6), sP(SEJ, 2025, -1.2e6)).find((x) => /отчётность/.test(x.t));
  assert.deepStrictEqual(h, { ton: 'huzhe', t: 'Появилась отчётность за 2025: выручка 48,0' + NB + 'млн' + NB + '₽, убыток 1,2' + NB + 'млн' + NB + '₽' });
  assert.strictEqual(D.sravnit(sP(RAN, 2024, -3e6), sP(SEJ, 2025, 5e5)).find((x) => /отчётность/.test(x.t)).ton, 'luchshe');
  assert.strictEqual(D.sravnit(sP(RAN, 2024, 3e6), sP(SEJ, 2025, 5e6)).find((x) => /отчётность/.test(x.t)).ton, 'info');
  assert.strictEqual(D.sravnit(sP(RAN, 2024, -3e6), sP(SEJ, 2025, -5e6)).find((x) => /отчётность/.test(x.t)).ton, 'info');
  const bez = D.snimok(otvet(RAN, 2024)); delete bez.prib;
  assert.strictEqual(D.sravnit(bez, sP(SEJ, 2025, -1e6)).find((x) => /отчётность/.test(x.t)).ton, 'info', 'прошлой прибыли нет — не сравниваем');
});

test('html «что изменилось»: строка ликвидности, без NaN и обещаний', () => {
  const st = {}, ls = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } };
  D.zapomnit(otvet(RAN, 2024, '1,3'), ls);
  const h = D.htmlIzmeneniya(D.zapomnit(otvet(SEJ, 2025, '0,4'), ls));
  assert.match(h, /<li class="izm--huzhe">Текущая ликвидность опустилась ниже 1/);
  assert.ok(!/NaN|undefined|Infinity/.test(h));
  assert.doesNotMatch(h, /банкрот|однодневк|мошен|гарант|надёжн|опасн|не плат/i);
  assert.ok(JSON.stringify(JSON.parse(st.dlk_snimki)).length < 2000, 'снимок маленький');
});
