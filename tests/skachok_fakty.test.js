// skachok-fakty-v1 [Ночные-3] 10.10 — «Скачок в отчётности» в «Только существенных фактах» экрана проверки:
// только падение (выручка или активы −50 % и больше), расчёт — Dinamika.skachok (skachok-v1), источник и дата у строки.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sushchestvennoe.js');
const D = require('../js/dinamika.js');

const NB = '\u00a0';
const sp_ = (t) => String(t).replace(/\u00a0/g, ' ');
const RYAD = (vals, ot = 2021) => vals.map((v, i) => ({ year: ot + i, value: v }));
function otvet({ rev = [], profit, aktDelta, aktValue = 50e6, balGod = 2025, signals } = {}) {
  const kpi = [];
  if (aktDelta !== undefined) kpi.push({ label: 'Активы', value: aktValue, delta: aktDelta, good_up: true });
  return {
    checked_at: '2026-10-10T17:22:00Z',
    company: { inn: '7700000000', name: 'ООО «Пример»', okved: '46.90', reg_date: '2015-03-01', status: 'ACTIVE' },
    signals: signals || [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ', as_of: '2026-10-10' }],
    dossier: { kpi, charts: { revenue: rev, profit: profit || [], balance: { year: balGod, equity: 1, long_debt: 1, short_debt: 1 } } }
  };
}
const najti = (r) => S.fakty(r).spisok.concat(S.fakty(r).eshche || []).filter((f) => f.k === 'skachok');

test('выручка упала на 58 % — строка «внимание» среди первых, источник ГИР БО и дата 31.12 года', () => {
  const r = otvet({ rev: RYAD([100e6, 90e6, 38e6], 2023) });
  const sp = S.fakty(r).spisok;
  const f = sp.find((x) => x.k === 'skachok');
  assert.ok(f, 'строка есть в списке существенных');
  assert.strictEqual(f.ton, 'warn');
  assert.strictEqual(f.nazv, 'Скачок в' + NB + 'отчётности');
  assert.match(sp_(f.znach), /^Выручка за 2025 год — на 58 % меньше, чем за 2024\.$/);
  assert.strictEqual(f.pod, 'Перед авансом спросите компанию, что изменилось.');
  assert.strictEqual(f.ist, 'ГИР БО ФНС');
  assert.strictEqual(f.data, '31.12.2025');
  assert.ok(sp.indexOf(f) < sp.findIndex((x) => x.k === 'status'), 'замечание выше строк без замечаний');
});

test('рост ×2 и больше в факты не выносим — он остаётся в «Динамике» с оговоркой', () => {
  const r = otvet({ rev: RYAD([10e6, 12e6, 30e6]), aktDelta: 294 });
  assert.ok(D.skachok(r), 'в «Динамике» скачок есть');
  assert.strictEqual(najti(r).length, 0);
});

test('активы −60 % — строка с датой баланса; выручка и активы вместе — одна строка, оба факта', () => {
  const a = najti(otvet({ aktDelta: -60 }))[0];
  assert.ok(a);
  assert.match(sp_(a.znach), /^Активы на 31\.12\.2025 — на 60 % меньше, чем годом раньше\.$/);
  assert.strictEqual(a.data, '31.12.2025');
  const oba = najti(otvet({ rev: RYAD([100e6, 40e6], 2024), aktDelta: -55 }));
  assert.strictEqual(oba.length, 1);
  assert.match(sp_(oba[0].znach), /Выручка за 2025 год — на 60 % меньше.*Активы на 31\.12\.2025 — на 55 % меньше/);
});

test('нет скачка, малая база, пропуск года, рост активов при падении выручки меньше 50 % — строки нет', () => {
  assert.strictEqual(najti(otvet({ rev: RYAD([100e6, 90e6, 60e6]) })).length, 0, '−33 % — не скачок');
  assert.strictEqual(najti(otvet({ rev: RYAD([900e3, 300e3]) })).length, 0, 'база меньше 1 млн ₽');
  assert.strictEqual(najti(otvet({ rev: [{ year: 2022, value: 100e6 }, { year: 2025, value: 10e6 }] })).length, 0, 'годы не соседние');
  assert.strictEqual(najti(otvet({ aktDelta: -49 })).length, 0);
});

test('без модуля «Динамики» строки нет (второго расчёта нет); не больше 7 строк при скачке', () => {
  assert.strictEqual(S.skachokVniz(otvet({ rev: RYAD([100e6, 30e6]) }), { Dinamika: {} }), null);
  const mnogo = [
    { id: 'status', title: 'Статус', status: 'warn', detail: 'Реорганизация', source: 'ЕГРЮЛ', as_of: '2026-10-10' },
    { id: 'address', title: 'Адрес', status: 'warn', detail: 'Массовый адрес', source: 'ЕГРЮЛ', as_of: '2026-10-10' },
    { id: 'tax_debt', title: 'Долги по налогам', status: 'bad', detail: 'Есть', source: 'ФНС', as_of: '2026-09-01' },
    { id: 'age', title: 'Возраст', status: 'ok', detail: '10 лет', source: 'ЕГРЮЛ', as_of: '2026-10-10' },
    { id: 'employees', title: 'Сотрудники', status: 'ok', detail: '12 чел.', source: 'ФНС', as_of: '2026-10-10' },
    { id: 'mass', title: 'Массовый руководитель', status: 'warn', detail: 'Да', source: 'ФНС', as_of: '2026-10-10' }
  ];
  const r = otvet({ rev: RYAD([100e6, 30e6], 2024), profit: RYAD([-1e6, -2e6], 2024), signals: mnogo });
  const res = S.fakty(r);
  assert.ok(res.spisok.length <= S.MAKS);
  assert.ok(res.spisok.concat(res.eshche || []).some((f) => f.k === 'skachok'));
});

test('HTML строки: факт, подстрочник, источник и дата; без HTML из ответа', () => {
  const h = S.html(otvet({ rev: RYAD([100e6, 38e6], 2024) }));
  assert.match(h, /data-fakt="skachok"/);
  assert.match(h, /Перед авансом спросите компанию, что изменилось\./);
  assert.match(h, /ГИР БО ФНС/);
});
