// «Что изменилось»: срок возражения кредитора под строкой «ФНС готовит исключение» и строка «Компания исключена из ЕГРЮЛ»
// (коды 407/414/415/418/420). Тексты — [Право] 03.10 14:30, claude/Право_исключение_ЕГРЮЛ_ответы_Разбор9_03.10.md, разд. 1.
// node --test tests/status_kod_srok.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
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

test('плюс месяцы: конец месяца и переход года', () => {
  assert.strictEqual(D.plusMes('2026-10-01', 3), '2027-01-01');
  assert.strictEqual(D.plusMes('2026-11-30', 3), '2027-02-28');
  assert.strictEqual(D.plusMes('2026-08-31', 6), '2027-02-28');
  assert.strictEqual(D.plusMes('2027-08-31', 6), '2028-02-29');
  assert.strictEqual(D.plusMes('вчера', 3), '');
});

test('105: подстрочник — 3 месяца, «ориентировочно до» от даты записи, «Вестник»', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '105', state_actuality_date: '2026-10-01' }, 'bad'));
  const x = D.sravnit(A, b)[0];
  assert.strictEqual(x.pod, 'Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение 3' + NB +
    'месяцев со дня публикации в «Вестнике государственной регистрации». Ориентировочно до' + NB + '01.01.2027. Дату публикации проверьте на vestnik-gosreg.ru.');
});

test('108: 6 месяцев; без даты записи — без «ориентировочно»', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '108', state_actuality_date: '2026-09-15' }));
  assert.ok(D.sravnit(A, b)[0].pod.includes('6' + NB + 'месяцев') && D.sravnit(A, b)[0].pod.includes('до' + NB + '15.03.2027'));
  const c = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '110' }));
  const p = D.sravnit(A, c)[0].pod;
  assert.ok(p.includes('3' + NB + 'месяцев') && !/Ориентировочно/.test(p), p);
});

test('HTML: подстрочник отдельной строкой, ссылка на «Вестник», текст экранирован', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '107', state_actuality_date: '2026-10-01' }));
  const h = D.htmlIzmeneniya({ s: A, izm: D.sravnit(A, b) });
  assert.ok(h.includes('<small class="izm__pod">Новых авансов не платите.'), h);
  assert.ok(h.includes('<a href="https://vestnik-gosreg.ru/" target="_blank" rel="noopener">vestnik-gosreg.ru</a>'));
  assert.ok(h.includes('«Вестнике государственной регистрации»'));
});

test('действующая → 414: «Компания исключена из ЕГРЮЛ», одна строка, подстрочник [Право]', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATED', state_code: '414', state_actuality_date: '2026-10-02' }, 'bad'));
  const izm = D.sravnit(A, b);
  assert.strictEqual(izm.length, 1, JSON.stringify(izm));
  assert.strictEqual(izm[0].ton, 'huzhe');
  assert.strictEqual(izm[0].t, 'Компания исключена из' + NB + 'ЕГРЮЛ: запись в' + NB + 'ЕГРЮЛ от' + NB + '02.10.2026 (на' + NB + 'прошлой проверке — действующая)');
  assert.strictEqual(izm[0].pod.replace(/\u00a0/g, ' '), 'Последствия — как при ликвидации (п. 2 ст. 64.2 ГК РФ): договор с ней не заключайте и не платите.');
});

test('готовилось исключение (105) → исключена (407): прошлая подпись точная', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00Z', { status: 'LIQUIDATING', state_code: '105' }, 'bad'));
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATED', state_code: '407' }, 'bad'));
  const izm = D.sravnit(a, b);
  assert.strictEqual(izm.length, 1);
  assert.ok(/^Компания исключена из\u00a0ЕГРЮЛ \(на\u00a0прошлой проверке — готовится исключение из\u00a0ЕГРЮЛ\)$/.test(izm[0].t), izm[0].t);
});

test('ликвидирована без кода → 407: не утверждаем, строк про исключение нет', () => {
  const a = D.snimok(otvet('2026-09-01T10:00:00Z', { status: 'LIQUIDATED' }, 'bad'));
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATED', state_code: '407' }, 'bad'));
  assert.deepStrictEqual(D.sravnit(a, b), []);
});

test('sDop сохраняет подстрочник', () => {
  const b = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATING', state_code: '105', state_actuality_date: '2026-10-01' }));
  const rez = { s: A, izm: D.sravnit(A, b) };
  const nov = D.sDop(rez, b, () => ({ ton: 'info', t: 'Строка', pod: 'Подпись' }));
  assert.ok(nov.izm.every((x) => x.pod));
});

test('«Ваши контрагенты»: исключённая — «Компания исключена из ЕГРЮЛ»', () => {
  const t = Date.parse('2026-10-03T10:00:00Z');
  const s = D.snimok(otvet('2026-10-03T10:00:00Z', { status: 'LIQUIDATED', state_code: '420' }));
  const rows = P.sobrat({ '7701234567': [A, s] }, []);
  assert.ok(P.html(rows, t).includes('<span class="pf__isk">Компания исключена из' + NB + 'ЕГРЮЛ</span>'));
});

test('тексты [Право]: «возражение», без «заявление в налоговую», «пока решение не исполнено», «долг пропад»', () => {
  const src = fs.readFileSync(require.resolve('../js/dinamika.js'), 'utf8') + fs.readFileSync(require.resolve('../js/portfel.js'), 'utf8');
  assert.ok(!/заявление в\s?налоговую|пока решение не исполнено|долг пропад|гарантир/i.test(src));
  assert.ok(/возражение в налоговую/.test(src));
});
