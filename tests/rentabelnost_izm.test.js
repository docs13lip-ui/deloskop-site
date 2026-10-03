// rentabelnost-izm-v1 (Ночные-3, 03.10): «Что изменилось с вашей проверки» — рентабельность активов против нормы ФНС.
// Снимок (js/dinamika.js) хранит оценку rn = [год, %] без норм; строку собирает js/rentabelnost.js после загрузки норм.
// node --test tests/rentabelnost_izm.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');
const R = require('../js/rentabelnost.js');
const NB = '\u00a0';
const NORMY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'fns-normy-2025.json'), 'utf8'));

// ОКВЭД 46.90 (оптовая торговля): нормы — из справочника, без подстановки руками
const OKVED = '46.90';
function otvet(t, god, pribyl, over) {
  return Object.assign({
    company: { inn: '7740000076', kind: 'LEGAL', status: 'ACTIVE', okved: OKVED, name_short: 'ООО «Пример»' },
    risk_level: 'low', checked_at: t, signals: [],
    dossier: { sections: [], charts: { revenue: [{ year: god, value: 400e6 }], profit: [{ year: god, value: pribyl }],
      balance: { year: god, equity: 50e6, long_liab: 0, short_liab: 50e6 } } },
  }, over || {});
}
const RAN = '2026-04-12T10:00:00Z', SEJ = '2026-10-03T04:30:00Z';
const norma = (god) => R.sravnenie(0, god, OKVED, NORMY).norma;

test('справочник: для 46.90 есть нормы за 2024 и 2025 — числа больше нуля', () => {
  assert.ok(norma(2024) > 0 && norma(2025) > 0, [norma(2024), norma(2025)].join(' / '));
});

test('снимок хранит оценку rn = [год, % с 1 знаком] — тот же расчёт, что в блоке «против отрасли»', () => {
  const r = otvet(SEJ, 2025, 3.456e6);
  assert.deepStrictEqual(D.snimok(r).rn, [2025, 3.5]);
  assert.strictEqual(Math.round(R.raschet(r, NORMY).n * 10) / 10, 3.5);
  // нет баланса, активы < 1 млн, банк, ИП — оценки нет
  const bez = otvet(SEJ, 2025, 1e6); delete bez.dossier.charts.balance;
  assert.ok(!('rn' in D.snimok(bez)));
  const mal = otvet(SEJ, 2025, 1e5); mal.dossier.charts.balance = { year: 2025, equity: 3e5, long_liab: 0, short_liab: 2e5 };
  assert.ok(!('rn' in D.snimok(mal)));
  assert.ok(!('rn' in D.snimok(otvet(SEJ, 2025, 1e6, { company: { inn: '7740000076', status: 'ACTIVE', okved: '64.19' } }))));
  assert.ok(!('rn' in D.snimok(otvet(SEJ, 2025, 1e6, { company: { inn: '500100732259', status: 'ACTIVE', okved: OKVED } }))));
});

test('переход «не ниже → ниже на 10% и более» — «хуже»; обратно — «лучше»; без перехода — молчим', () => {
  const vys = (god) => norma(god) * 1e6 * 1.2, niz = (god) => norma(god) * 1e6 * 0.5; // активы 100 млн ₽ → 1 % = 1 млн ₽
  const a = D.snimok(otvet(RAN, 2024, vys(2024))), b = D.snimok(otvet(SEJ, 2025, niz(2025)));
  const h = R.izmenenie(a, b, OKVED, NORMY);
  assert.strictEqual(h.ton, 'huzhe');
  assert.strictEqual(h.t, 'Рентабельность активов стала ниже средней по отрасли на 10% и более: за' + NB + '2025 — ' +
    R.pct(b.rn[1]) + ' при средней ' + R.pct(norma(2025)) + ' (оценка; ГИР' + NB + 'БО и ФНС)');
  const l = R.izmenenie(D.snimok(otvet(RAN, 2024, niz(2024))), D.snimok(otvet(SEJ, 2025, vys(2025))), OKVED, NORMY);
  assert.strictEqual(l.ton, 'luchshe');
  assert.match(l.t, /^Рентабельность активов больше не ниже средней по отрасли на 10% и более: за\u00a02025 — /);
  assert.strictEqual(R.izmenenie(D.snimok(otvet(RAN, 2024, vys(2024))), D.snimok(otvet(SEJ, 2025, vys(2025))), OKVED, NORMY), null, 'обе в норме');
  assert.strictEqual(R.izmenenie(D.snimok(otvet(RAN, 2024, niz(2024))), D.snimok(otvet(SEJ, 2025, niz(2025))), OKVED, NORMY), null, 'обе ниже');
  assert.strictEqual(R.izmenenie(D.snimok(otvet(RAN, 2025, vys(2025))), D.snimok(otvet(SEJ, 2025, niz(2025))), OKVED, NORMY), null, 'тот же год');
  assert.strictEqual(R.izmenenie(D.snimok(otvet(RAN, 2023, vys(2024))), D.snimok(otvet(SEJ, 2025, niz(2025))), OKVED, NORMY), null, 'норм за 2023 нет');
  const star = D.snimok(otvet(RAN, 2024, vys(2024))); delete star.rn;
  assert.strictEqual(R.izmenenie(star, b, OKVED, NORMY), null, 'старый снимок без оценки');
  assert.strictEqual(R.izmenenie(a, b, '', NORMY), null, 'без ОКВЭД — нормы нет');
});

test('sravnit(a, b, dop) ставит строку по тону; sDop добавляет её в показанный блок один раз', () => {
  const vys = norma(2024) * 1.2e6, niz = norma(2025) * 0.5e6;
  const a = D.snimok(otvet(RAN, 2024, vys)), b = D.snimok(otvet(SEJ, 2025, niz));
  const fn = (x, y) => R.izmenenie(x, y, OKVED, NORMY);
  const v = D.sravnit(a, b, fn);
  assert.ok(v.some((x) => x.ton === 'huzhe' && /^Рентабельность активов стала ниже/.test(x.t)));
  assert.ok(v.findIndex((x) => /Рентабельность/.test(x.t)) < v.findIndex((x) => /отчётность/.test(x.t)), '«хуже» — выше справочных');
  assert.deepStrictEqual(D.sravnit(a, b, () => { throw new Error('x'); }), D.sravnit(a, b), 'ошибка dop — без строки');
  const rez = { s: a, izm: D.sravnit(a, b) };
  const nov = D.sDop(rez, b, fn);
  assert.strictEqual(nov.izm[0].ton, 'huzhe');
  assert.strictEqual(nov.izm.length, rez.izm.length + 1);
  assert.strictEqual(D.sDop(nov, b, fn), null, 'повторно не добавляем');
  assert.strictEqual(D.sDop({ pervyj: true }, b, fn), null, 'первая проверка — сравнивать не с чем');
});

test('html: строка в блоке «что изменилось», без NaN и запрещённых слов', () => {
  const st = {}, ls = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } };
  D.zapomnit(otvet(RAN, 2024, norma(2024) * 1.2e6), ls);
  const b = otvet(SEJ, 2025, norma(2025) * 0.5e6), rez = D.zapomnit(b, ls);
  const h = D.htmlIzmeneniya(D.sDop(rez, D.snimok(b), (x, y) => R.izmenenie(x, y, OKVED, NORMY)));
  assert.match(h, /<li class="izm--huzhe">Рентабельность активов стала ниже средней по отрасли/);
  assert.ok(!/NaN|undefined|Infinity/.test(h));
  assert.doesNotMatch(h, /банкрот|однодневк|мошен|гарант|надёжн|опасн|не плат|выездн/i);
  assert.ok(JSON.stringify(JSON.parse(st.dlk_snimki)).length < 2000, 'снимок маленький');
});
