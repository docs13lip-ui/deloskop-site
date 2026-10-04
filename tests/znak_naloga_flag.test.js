// znak-naloga-v1.1 (Ночные-3, 04.10): сайт заранее понимает контракт API [Продукт · Данные] 04.10 разд. 1 —
// `charts.income_tax_znak`, `znak` у точки налога, `charts.profit_before_tax` (строка 2300). Без этих полей — как в v1.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../js/rentabelnost.js');
const D = require('../js/dinamika.js');
const NORMY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fns-normy-2025.json'), 'utf8'));

// форма живого ответа ПАО «Аэрофлот» (7712040126) от 04.10.2026: налог — модуль во все годы
function aeroflot() {
  return {
    company: { inn: '7712040126', okved: '51.10', name_short: 'ПАО «Аэрофлот»' },
    dossier: { charts: {
      profit: [{ year: 2020, value: -96527133000 }, { year: 2021, value: -45639139000 }, { year: 2022, value: -14312335000 },
        { year: 2023, value: -29456385000 }, { year: 2024, value: 21958748000 }, { year: 2025, value: 123037451000 }],
      income_tax: [{ year: 2020, value: 26622644000 }, { year: 2021, value: 10761825000 }, { year: 2022, value: 280720000 },
        { year: 2023, value: 1313403000 }, { year: 2024, value: 14926005000 }, { year: 2025, value: 37143546000 }],
      balance: { year: 2025, equity: 26745345000, long_debt: 595284508000, short_debt: 311968276000 }
    } }
  };
}
// граница: прибыльная компания, у которой «расход» и «доход» по налогу дают разный вывод (без флага — «сравнить точно нельзя»)
function uGranicy() {
  const r = aeroflot(), ch = r.dossier.charts;
  const o = R.ocenka(r);
  const sr = R.sravnenie(o.nMax, o.god, '51.10', NORMY);
  const cel = sr.norma * 0.9 / 100 * o.aktivy;
  ch.profit[5].value = cel; ch.income_tax[5].value = Math.abs(cel) * 0.5 + 1e9;
  return r;
}

test('без флагов — как в v1: у границы нормы «сравнить точно нельзя»', () => {
  assert.strictEqual(R.raschet(uGranicy(), NORMY).st, 'neyasno');
});

test('income_tax_znak: true — точный расчёт у прибыльной компании без отрицательных значений', () => {
  const r = uGranicy(), ch = r.dossier.charts;
  ch.income_tax_znak = true;
  ch.income_tax.forEach((x) => { x.znak = true; });
  const o = R.ocenka(r);
  assert.strictEqual(o.bezZnaka, false);
  assert.strictEqual(o.nMin, o.nMax);
  assert.strictEqual(o.rez, ch.profit[5].value + ch.income_tax[5].value, 'налог > 0 — расход');
  const x = R.raschet(r, NORMY);
  assert.ok(['ne-nizhe', 'chut-nizhe', 'nizhe'].includes(x.st), 'вывод есть: ' + x.st);
  assert.doesNotMatch(R.html(x), /сравнить точно нельзя/i);
  assert.deepStrictEqual(D.nalogBezZnaka(ch), [], '«±» в «Динамике» нет');
});

test('смешанный ряд: точка znak: false — модуль (два варианта и «±»), даже если рядом есть доход < 0', () => {
  const r = uGranicy(), ch = r.dossier.charts;
  ch.income_tax_znak = false;
  ch.income_tax.forEach((x) => { x.znak = true; });
  ch.income_tax[0].value = -26622644000; // 2020 — доход по налогу, знак известен
  ch.income_tax[5].znak = false;          // 2025 — строки 2300 нет
  assert.strictEqual(R.nalogSoZnakom(ch, 2020), true);
  assert.strictEqual(R.nalogSoZnakom(ch, 2025), false);
  assert.strictEqual(R.ocenka(r).bezZnaka, true);
  assert.strictEqual(R.raschet(r, NORMY).st, 'neyasno');
  ch.income_tax[1].znak = false;          // 2021 — убыток и налог без знака
  assert.deepStrictEqual(D.nalogBezZnaka(ch), [2021], '2020 со знаком — без «±», 2021 — с «±»');
});

test('строка 2300 (profit_before_tax) за год — налог = 2300 − чистая прибыль, точно и со знаком', () => {
  const r = aeroflot(), ch = r.dossier.charts;
  ch.profit_before_tax = [{ year: 2020, value: -123149777000 }, { year: 2025, value: 160181000000 }];
  const o = R.ocenka(r);
  assert.strictEqual(o.bezZnaka, false);
  assert.strictEqual(o.rez, 160181000000);
  assert.strictEqual(o.nalog, 160181000000 - 123037451000);
  // 2020: 2300 есть — «±» не нужен; 2021–2023 — убыток, 2300 нет — «±» остаётся
  assert.deepStrictEqual(D.nalogBezZnaka(ch), [2021, 2022, 2023]);
  ch.profit_before_tax.push({ year: 2025, value: null });
  assert.strictEqual(R.ocenka(r).rez, 160181000000, 'пустая точка не мешает');
});

test('доход по налогу из 2300: «минус доход по налогу на прибыль»', () => {
  const r = aeroflot(), ch = r.dossier.charts;
  ch.profit_before_tax = [{ year: 2025, value: 120000000000 }];
  const o = R.ocenka(r);
  assert.strictEqual(o.nalog, 120000000000 - 123037451000);
  assert.match(R.html(Object.assign(o, { st: 'ne-nizhe', istochnik: 'Информация ФНС от 05.05.2026' })), /минус доход по налогу на прибыль/);
});

test('PDF-досье понимает те же поля', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.match(h, /ch\.income_tax_znak===true/);
  assert.match(h, /profit_before_tax/);
  assert.match(h, /t\.znak===true/);
});

test('«Динамика»: налог со знаком < 0 — словом «доход», а не минусом', () => {
  const ch = { income_tax_znak: true,
    profit: [{ year: 2023, value: -5e9 }, { year: 2024, value: 2e9 }, { year: 2025, value: -3e9 }],
    income_tax: [{ year: 2023, value: -1e9, znak: true }, { year: 2024, value: 5e8, znak: true }, { year: 2025, value: -7e8, znak: true }] };
  const s = D.ryady({ dossier: { charts: ch } }).map(D.stroka).find((x) => x.k === 'income_tax');
  assert.match(s.znachTekst, /^доход 700,0/);
  const h = D.htmlDinamika({ dossier: { charts: ch } });
  assert.match(h, /доход 700,0/);
  assert.doesNotMatch(h, /±/);
});
