// «Что изменилось» и «Ваши контрагенты»: код состояния ЕГРЮЛ (company.state_code, API status-kody-api-v1).
// 105–107, 110 — «ФНС готовит исключение из ЕГРЮЛ»; 108 — «…по сведениям Банка России» (заголовки [Право] 03.10).
// node --test tests/status_kod_izm.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const P = require('../js/portfel.js');
const NB = '\u00a0';

function otvet(t, c, sigSt) {
  return {
    company: Object.assign({ inn: '7701234567', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ООО «Пример»' }, c || {}),
    risk_level: 'medium', checked_at: t,
    signals: [{ id: 'status', title: 'Статус', status: sigSt || 'ok', detail: '' }],
  };
}
const A = D.snimok(otvet('2026-09-01T10:00:00Z'));

test('снимок: код и дата записи — только трёхзначный код, дата ISO', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: 105, state_actuality_date: '2026-10-01T00:00:00' }));
  assert.strictEqual(b.kod, '105');
  assert.strictEqual(b.kodd, '2026-10-01');
  const c = D.snimok(otvet('2026-10-03T10:00:00Z', { state_code: '10<b>', state_actuality_date: 'вчера' }));
  assert.strictEqual(c.kod, undefined);
  assert.strictEqual(c.kodd, undefined);
  assert.strictEqual(A.kod, undefined, 'API без кода — поля нет');
});

test('действующая → код 105: одна строка «ФНС готовит исключение», без дублей статуса и сигнала', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '105', state_actuality_date: '2026-10-01' }, 'bad'));
  const izm = D.sravnit(A, b);
  assert.strictEqual(izm.length, 1, JSON.stringify(izm));
  assert.strictEqual(izm[0].ton, 'huzhe');
  assert.strictEqual(izm[0].t, 'ФНС готовит исключение из ЕГРЮЛ: запись в' + NB + 'ЕГРЮЛ от' + NB + '01.10.2026 (на' + NB + 'прошлой проверке — действующая)');
});

test('код 108 — «по сведениям Банка России»; без даты записи — без «запись от»', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '108' }));
  const t = D.sravnit(A, b)[0].t;
  assert.ok(t.startsWith('ФНС готовит исключение из ЕГРЮЛ по' + NB + 'сведениям Банка России'), t);
  assert.ok(!/запись/.test(t));
});

test('отметка снята: код исключения → действующая — зелёная строка', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00Z', { status: 'LIQUIDATING', state_code: '106' }, 'bad'));
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', {}, 'ok'));
  const izm = D.sravnit(a, b);
  assert.strictEqual(izm.length, 1, JSON.stringify(izm));
  assert.strictEqual(izm[0].ton, 'luchshe');
  assert.ok(/больше нет: компания действующая$/.test(izm[0].t));
});

test('старый снимок «ликвидируется» без кода → код 105: не утверждаем, что «начала», строк нет', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00Z', { status: 'LIQUIDATING' }));
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '105' }));
  assert.deepStrictEqual(D.sravnit(a, b), []);
});

test('ликвидация по решению участников (код 101) → исключение: точные подписи статуса', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00Z', { status: 'LIQUIDATING', state_code: '101' }));
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '107' }));
  const izm = D.sravnit(a, b);
  assert.strictEqual(izm.length, 1);
  assert.ok(/на\u00a0прошлой проверке — ликвидируется\)$/.test(izm[0].t), izm[0].t);
  // без кода — прежняя подпись, без изменений поведения
  const c = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATED' }));
  assert.strictEqual(D.sravnit(A, c)[0].t, 'Статус в ЕГРЮЛ: действующая → ликвидирована');
});

test('ИП: код состояния не храним', () => {
  const s = D.snimok({ company: { inn: '770123456789', status: 'LIQUIDATING', state_code: '105' }, checked_at: '2026-10-03T10:00:00Z' });
  assert.strictEqual(s.kod, undefined);
});

test('«Ваши контрагенты»: отметка по последнему снимку; более поздняя проверка без снимка её снимает', () => {
  const t = Date.parse('2026-10-03T10:00:00Z');
  const s = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '108' }));
  let rows = P.sobrat({ '7701234567': [A, s] }, []);
  assert.strictEqual(rows[0].isk, '108');
  const h = P.html(rows, t);
  assert.ok(h.includes('<span class="pf__isk">ФНС готовит исключение из' + NB + 'ЕГРЮЛ по' + NB + 'сведениям Банка России</span>'));
  rows = P.sobrat({ '7701234567': [s] }, [{ inn: '7701234567', t: t + 5 * 3600 * 1000, level: 'low' }]);
  assert.strictEqual(rows[0].isk, undefined);
  assert.ok(!P.html(rows, t).includes('pf__isk'));
  rows = P.sobrat({ '7701234567': [A] }, []);
  assert.ok(!P.html(rows, t).includes('pf__isk'), 'без кода — без отметки');
});

test('тексты: без «отмыв», «незаконн», обещаний исхода', () => {
  const src = require('node:fs').readFileSync(require.resolve('../js/dinamika.js'), 'utf8') + require('node:fs').readFileSync(require.resolve('../js/portfel.js'), 'utf8');
  assert.ok(!/отмыв|незаконн|гарантир|обязательно исключ|долг пропад/i.test(src));
});
