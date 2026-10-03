// «Что изменилось»: смена основного вида деятельности (ЕГРЮЛ) и кредиты и займы против выручки (ГИР БО) — js/dinamika.js, okved-zajmy-izm-v1.
// node --test tests/okved_zajmy_izm.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const NB = ' ';

// Форма живого ответа /api/check 03.10 (ПАО «Газпром»: company.okved, okved_name = null, строка досье «Основной вид деятельности», charts.debts)
function otvet(o) {
  o = o || {};
  const god = o.god || 2025;
  return {
    company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', director_since: '2007-04-12', director_name: 'Иванов Иван Иванович',
      okved: o.okved === undefined ? '46.71.4' : o.okved, okved_name: o.okved_name === undefined ? null : o.okved_name, invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: o.t || '2026-10-03T06:30:00Z',
    signals: [{ id: 'status', title: 'Статус', status: 'ok' }],
    zsk: { level: 'low' },
    dossier: {
      charts: Object.assign({
        revenue: [{ year: god - 1, value: 5e9 }, { year: god, value: o.vyr === undefined ? 5846e9 : o.vyr }],
        profit: [{ year: god - 1, value: 1e9 }, { year: god, value: 11.3e9 }],
      }, o.loans === undefined ? {} : { debts: { year: god, receivables: 1, payables: 2, loans: o.loans } }),
      sections: [{ id: 'activity', rows: [['Основной вид деятельности', o.stroka === undefined ? '46.71.4 — Торговля оптовая природным (естественным) газом' : o.stroka]] }],
    },
  };
}
const kod = (r) => { const s = D.snimok(r); return [s.ok, s.okn]; };
const pro = (a, b, re) => D.sravnit(D.snimok(a), D.snimok(b)).filter((x) => re.test(x.t)).map((x) => x.ton + ': ' + x.t);

test('ОКВЭД в снимке: код из company.okved, название — okved_name или строка досье с тем же кодом', () => {
  assert.deepStrictEqual(kod(otvet()), ['46.71.4', 'Торговля оптовая природным (естественным) газом']);
  assert.deepStrictEqual(kod(otvet({ okved_name: 'Строительство жилых и нежилых зданий', okved: '41.20' })), ['41.20', 'Строительство жилых и нежилых зданий']);
  assert.deepStrictEqual(kod(otvet({ okved: '41.20' })), ['41.20', undefined], 'в строке досье другой код — название не берём');
  for (const k of [null, '', '4', 'abc', '46.71.4.1.2', '46,71']) assert.ok(!('ok' in D.snimok(otvet({ okved: k }))), 'мусор: ' + k);
  const dl = D.snimok(otvet({ stroka: '46.71.4 — ' + 'очень длинное название '.repeat(8) })).okn;
  assert.ok(dl.length <= 90 && /…$/.test(dl), 'длинное название обрезано по слову');
  const ip = D.snimok(Object.assign(otvet(), { company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', okved: '62.01' } }));
  assert.ok(!('ok' in ip) && !('zm' in ip), 'у ИП не храним');
});

test('ОКВЭД: смена кода — справочная строка с новым названием; тот же код и старый снимок без кода — молчим', () => {
  const a = otvet({ t: '2026-09-01T10:00:00Z', okved: '46.90', stroka: '46.90 — Торговля оптовая неспециализированная' });
  assert.deepStrictEqual(pro(a, otvet(), /вид деятельности/), ['info: Основной вид деятельности в ЕГРЮЛ сменился: 46.90 → 46.71.4 — Торговля оптовая природным (естественным) газом']);
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z' }), otvet(), /вид деятельности/), []);
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', okved: null }), otvet(), /вид деятельности/), []);
});

test('займы в снимке: год и сумма из charts.debts.loans; ноль — значение, мусор — нет', () => {
  assert.deepStrictEqual(D.snimok(otvet({ loans: 4425.7e9 })).zm, [2025, 4425.7e9]);
  assert.deepStrictEqual(D.snimok(otvet({ loans: 0 })).zm, [2025, 0]);
  assert.ok(!('zm' in D.snimok(otvet())), 'нет debts — нет займов');
  for (const l of [null, '', true, 'x', -5]) assert.ok(!('zm' in D.snimok(otvet({ loans: l }))), 'loans = ' + l);
});

test('займы: стали больше годовой выручки — «хуже» первым; больше не превышают — «лучше»', () => {
  const a = otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 3e6, vyr: 10e6 });
  const b = otvet({ god: 2025, loans: 14.2e6, vyr: 12e6 });
  const v = D.sravnit(D.snimok(a), D.snimok(b));
  assert.deepStrictEqual(v[0], { ton: 'huzhe', t: 'Кредиты и займы стали больше годовой выручки: на' + NB + '31.12.2025 — 14,2' + NB + 'млн' + NB + '₽, выручка за 2025 — 12,0' + NB + 'млн' + NB + '₽ (ГИР' + NB + 'БО)' });
  assert.strictEqual(v.filter((x) => /Кредиты/.test(x.t)).length, 1, 'одна строка, без «выросли в 4 раза» вдобавок');
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 20e6, vyr: 10e6 }), otvet({ god: 2025, loans: 9e6, vyr: 12e6 }), /Кредиты/),
    ['luchshe: Кредиты и займы больше не превышают годовую выручку: на' + NB + '31.12.2025 — 9,0' + NB + 'млн' + NB + '₽, выручка за 2025 — 12,0' + NB + 'млн' + NB + '₽ (ГИР' + NB + 'БО)']);
});

test('займы: рост в 2 раза и больше без перехода через выручку — справочно, «в 2,4 раза» без округления вверх', () => {
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 1e9, vyr: 50e9 }), otvet({ god: 2025, loans: 2.49e9, vyr: 50e9 }), /Кредиты/),
    ['info: Кредиты и займы выросли в' + NB + '2,4' + NB + 'раза: на' + NB + '31.12.2025 — 2,5' + NB + 'млрд' + NB + '₽, на' + NB + '31.12.2024 — 1,0' + NB + 'млрд' + NB + '₽ (ГИР' + NB + 'БО)']);
  assert.strictEqual(D.vRaz(2), 'в' + NB + '2' + NB + 'раза');
  assert.strictEqual(D.vRaz(5.04), 'в' + NB + '5' + NB + 'раз');
  assert.strictEqual(D.vRaz(21.6), 'в' + NB + '22' + NB + 'раза');
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 1e9, vyr: 50e9 }), otvet({ god: 2025, loans: 1.9e9, vyr: 50e9 }), /Кредиты/), [], 'меньше чем вдвое');
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 0, vyr: 50e9 }), otvet({ god: 2025, loans: 5e9, vyr: 50e9 }), /Кредиты/), [], 'с нуля — не «в N раз»');
});

test('займы: тот же год баланса, старый снимок без займов, нет выручки того же года — переход через выручку не считаем', () => {
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', loans: 1e6, vyr: 10e6 }), otvet({ loans: 30e6, vyr: 10e6 }), /Кредиты/), [], 'тот же 2025');
  assert.deepStrictEqual(pro(otvet({ t: '2026-09-01T10:00:00Z', god: 2024 }), otvet({ god: 2025, loans: 30e6, vyr: 10e6 }), /Кредиты/), [], 'старый снимок');
  // выручка в снимке — за 2025, а баланс — за 2024: переход не считаем, но рост вдвое — факт баланса
  const a = otvet({ t: '2026-09-01T10:00:00Z', god: 2023, loans: 1e6, vyr: 10e6 });
  const b = otvet({ god: 2025, loans: 30e6, vyr: 10e6 });
  b.dossier.charts.debts.year = 2024;
  assert.deepStrictEqual(pro(a, b, /Кредиты/).map((x) => x.split(':')[0]), ['info']);
});

test('html «что изменилось»: новые строки проходят экранированными, без NaN; в каждой строке займов — дата и источник', () => {
  const ls = { st: {}, getItem(k) { return k in this.st ? this.st[k] : null; }, setItem(k, v) { this.st[k] = String(v); } };
  D.zapomnit(otvet({ t: '2026-09-01T10:00:00Z', god: 2024, loans: 3e6, vyr: 10e6, okved: '46.90', stroka: '46.90 — Торговля <оптовая>' }), ls);
  const rez = D.zapomnit(otvet({ god: 2025, loans: 14e6, vyr: 12e6, okved: '41.20', stroka: '41.20 — Строительство <зданий>' }), ls);
  const h = D.htmlIzmeneniya(rez);
  assert.match(h, /<li class="izm--huzhe">Кредиты и займы стали больше годовой выручки/);
  assert.match(h, /<li class="izm--info">Основной вид деятельности в ЕГРЮЛ сменился: 46\.90 → 41\.20 — Строительство &lt;зданий&gt;<\/li>/);
  assert.ok(!/NaN|undefined|Infinity|<зданий>/.test(h));
  for (const x of rez.izm.filter((q) => /Кредиты/.test(q.t))) assert.match(x.t, new RegExp('31\\.12\\.\\d{4}.*\\(ГИР' + NB + 'БО\\)$'));
});

test('тексты без оценок и обещаний (38-ФЗ, 222-ФЗ): нет «опасн», «надёжн», «рискованн», «гарант»', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'dinamika.js'), 'utf8');
  const stroki = src.split('\n').filter((l) => /Кредиты и займы|Основной вид деятельности в ЕГРЮЛ/.test(l)).join('\n');
  assert.ok(stroki.length > 0);
  assert.ok(!/опасн|надёжн|надежн|рискованн|гарант/i.test(stroki));
});
