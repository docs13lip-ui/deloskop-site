// znak-naloga-v1 (Ночные-3, 04.10): налог на прибыль (строка 2410) в ответе /api/check — без знака.
// В год убытка это может быть доход по налогу, а не расход ([Ночные-2] 07:35, [Право] 04.10 08:10 разд. 1: «не гадаем»).
// Ряды — форма живого ответа ПАО «Аэрофлот» (7712040126) от 04.10.2026, ГИР БО.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../js/rentabelnost.js');
const D = require('../js/dinamika.js');
const NORMY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fns-normy-2025.json'), 'utf8'));
const NB = ' ';

function aeroflot() {
  return {
    company: { inn: '7712040126', okved: '51.10', name_short: 'ПАО «Аэрофлот»' },
    dossier: { charts: {
      revenue: [2020, 2021, 2022, 2023, 2024, 2025].map((y, i) => ({ year: y, value: [229766365000, 378657216000, 332747813000, 497511315000, 712928484000, 760401133000][i] })),
      profit: [{ year: 2020, value: -96527133000 }, { year: 2021, value: -45639139000 }, { year: 2022, value: -14312335000 },
        { year: 2023, value: -29456385000 }, { year: 2024, value: 21958748000 }, { year: 2025, value: 123037451000 }],
      income_tax: [{ year: 2020, value: 26622644000 }, { year: 2021, value: 10761825000 }, { year: 2022, value: 280720000 },
        { year: 2023, value: 1313403000 }, { year: 2024, value: 14926005000 }, { year: 2025, value: 37143546000 }],
      balance: { year: 2025, equity: 26745345000, long_debt: 595284508000, short_debt: 311968276000 }
    } }
  };
}

test('рентабельность: налог без знака — два варианта (расход и доход), вывод только если они согласны', () => {
  const r = aeroflot();
  const o = R.ocenka(r);
  assert.strictEqual(o.bezZnaka, true);
  assert.strictEqual(o.rez, 123037451000 + 37143546000);
  assert.strictEqual(o.rezMin, 123037451000 - 37143546000);
  assert.ok(o.nMin < o.nMax);
  assert.strictEqual(o.n, o.nMax, 'o.n — прежний вариант «расход» (совместимость снимков и тестов)');
  const x = R.raschet(r, NORMY);
  const h = R.html(x);
  assert.ok(h.includes(R.BEZ_ZNAKA), 'объяснение, почему два варианта');
  assert.ok(h.includes('считаем оба варианта'));
  assert.match(h, /<b class="n">\d+,\d–\d+,\d %<\/b>/, 'диапазон в крупной цифре');
});

test('рентабельность: варианты по разные стороны критерия 11 — «сравнить точно нельзя», без жёлтого и без признака отбора', () => {
  const r = aeroflot();
  const o = R.ocenka(r);
  // подбираем прибыль так, чтобы норма раздела попала между вариантами
  const sr = R.sravnenie(o.nMax, o.god, '51.10', NORMY);
  assert.ok(sr && typeof sr.norma === 'number', 'для 51.10 есть норма ФНС');
  const cel = sr.norma * 0.9 / 100 * o.aktivy; // ровно граница «на 10% ниже»
  r.dossier.charts.profit[5].value = cel; r.dossier.charts.income_tax[5].value = Math.abs(cel) * 0.5 + 1e9;
  const x = R.raschet(r, NORMY);
  assert.strictEqual(x.st, 'neyasno');
  const h = R.html(x);
  assert.match(h, /rnt--ro/);
  assert.doesNotMatch(h, /критерий 11/);
  assert.ok(h.includes(R.VYVOD.neyasno));
});

test('рентабельность: оба варианта ниже на 10% — «внимание»; ряд со знаком — один точный вариант', () => {
  const r = aeroflot(); r.dossier.charts.profit[5].value = 1e9; r.dossier.charts.income_tax[5].value = 0.2e9;
  const x = R.raschet(r, NORMY);
  assert.strictEqual(x.st, 'nizhe');
  assert.match(R.html(x), /rnt--warn/);
  // [Данные] начнут отдавать знак (доход < 0) — сайт сам перейдёт на точный расчёт
  const s = aeroflot(); s.dossier.charts.income_tax[0].value = -26622644000;
  const o = R.ocenka(s);
  assert.strictEqual(o.bezZnaka, false);
  assert.strictEqual(o.nMin, o.nMax);
  s.dossier.charts.income_tax[5].value = -1e9;
  const o2 = R.ocenka(s);
  assert.strictEqual(o2.rez, 123037451000 - 1e9);
  assert.match(R.html(Object.assign(o2, { st: 'ne-nizhe', istochnik: 'Информация ФНС от 05.05.2026' })), /минус доход по налогу на прибыль/);
});

test('рентабельность: налога нет или он 0 — прежний расчёт одним числом', () => {
  const r = aeroflot(); r.dossier.charts.income_tax = [];
  assert.strictEqual(R.ocenka(r).bezZnaka, false);
  assert.strictEqual(R.ocenka(r).sNalogom, false);
  const z = aeroflot(); z.dossier.charts.income_tax[5].value = 0;
  const o = R.ocenka(z);
  assert.strictEqual(o.bezZnaka, false);
  assert.strictEqual(o.nMin, o.nMax);
});

test('«Что изменилось»: снимок хранит оба варианта; «ниже/не ниже» — только если оба варианта согласны', () => {
  const n = R.sravnenie(1, 2025, '51.10', NORMY).norma, n24 = R.sravnenie(1, 2024, '51.10', NORMY).norma;
  const a = { rn: [2024, n24 * 0.5, n24 * 0.6] }; // оба ниже
  const b = { rn: [2025, n * 1.2, n * 1.4] }; // оба не ниже
  const iz = R.izmenenie(a, b, '51.10', NORMY);
  assert.ok(iz && iz.ton === 'luchshe', JSON.stringify(iz));
  assert.ok(iz.t.includes('–'), 'в строке — диапазон');
  const c = { rn: [2025, n * 0.5, n * 1.4] }; // варианты по разные стороны
  assert.strictEqual(R.izmenenie(a, c, '51.10', NORMY), null);
  // старый снимок [год, оценка] читается как раньше
  assert.ok(R.izmenenie({ rn: [2024, n24 * 0.5] }, { rn: [2025, n * 1.3] }, '51.10', NORMY));
  // dinamika.js кладёт в снимок оба варианта
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dinamika.js'), 'utf8');
  assert.match(src, /ro\.bezZnaka && isFinite\(ro\.nMin\) \? \[ro\.god, Math\.round\(ro\.nMin \* 10\) \/ 10, Math\.round\(ro\.nMax \* 10\) \/ 10\]/);
});

test('«Динамика»: налог в год убытка — «±», без стрелки и без «в N раз»', () => {
  const r = aeroflot();
  assert.deepStrictEqual(D.nalogBezZnaka(r.dossier.charts), [2021, 2022, 2023], 'последние 5 лет ряда');
  // последние 5 лет: 2021–2025; убыточный 2023 — не в колонках, 2024/2025 прибыльные → стрелка остаётся
  const t = D.stroka(D.ryady(r).find((x) => x.k === 'income_tax'));
  assert.ok(t.kGodu, 'к прошлому году сравниваем: оба года прибыльные');
  assert.strictEqual(t.zaPeriod, '', 'первый год ряда — убыточный: «за период» не считаем');
  // прошлый год — убыточный: стрелки нет, «±» в ячейке и подпись
  const u = aeroflot(); u.dossier.charts.profit[4].value = -5e9;
  const h = D.htmlDinamika(u);
  const s = D.stroka(D.ryady(u).find((x) => x.k === 'income_tax'));
  assert.strictEqual(s.kGodu, '');
  assert.strictEqual(s.ton, 'ro');
  assert.ok(h.includes('±14,9' + NB + 'млрд'), 'знак «±» у суммы года убытка');
  assert.ok(h.includes('в год убытка не видно, расход это или доход'));
  // ряд со знаком — обычная строка
  const z = aeroflot(); z.dossier.charts.income_tax[0].value = -26622644000;
  assert.deepStrictEqual(D.nalogBezZnaka(z.dossier.charts), []);
});

test('Щит: цифра рентабельности — та же, что в блоке (диапазон при налоге без знака)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'shchit.js'), 'utf8');
  assert.ok(src.includes('R.znachenie ? R.znachenie(x) : R.pct(x.n)'));
  assert.strictEqual(R.diapazon(2.04, 3.96), '2,0–4,0' + NB + '%');
  assert.strictEqual(R.diapazon(-1.2, 0.6), '−1,2 … 0,6' + NB + '%');
  assert.strictEqual(R.diapazon(3, 3), '3,0' + NB + '%');
});

test('PDF-досье: оговорка о годе убытка у графика налога на прибыль', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.ok(src.includes("не видно, расход это или доход по налогу"));
});
