// Паспорт контрагента, раздел 6: полоса «На чём держится компания» (pasport-polosa-v1, Ночные-3 03.10).
// Доли полосы и строк раздела — один расчёт (P.strukturaBalansa): числа на рисунке и в таблице не расходятся.
// node --test tests/pasport_polosa.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const NB = '\u00a0';
const D = (balance) => ({ charts: { balance } });

test('доли — наибольшим остатком, в сумме ровно 100 %, те же, что в строках раздела 6', () => {
  const b = { year: 2025, equity: 1, long_debt: 1, short_debt: 1 };
  const s = P.strukturaBalansa(D(b));
  assert.deepStrictEqual(s.chasti.map((x) => x.p).reduce((a, x) => a + x, 0), 100);
  const r = { checked_at: '2026-10-03T12:00:00+03:00', company: { inn: '7736050003', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ПАО «Пример»' },
    risk_level: 'low', signals: [], dossier: D(b) };
  const p = P.sobrat(r, { usloviya: U, indeksVorota: IV });
  const f = p.razdely.find((x) => x.id === 'finansy').fakty.filter((x) => /баланса$/.test(x.znachenie));
  const izStrok = f.map((x) => +x.znachenie.match(/(\d+)\u00a0% баланса$/)[1]);
  assert.deepStrictEqual(izStrok, s.chasti.map((x) => x.p));
  const h = P.polosaBalansaHtml(D(b), U);
  s.chasti.forEach((x) => assert.ok(h.includes('<b>' + x.p + NB + '%</b>'), x.nazv));
});

test('полоса: подпись с датой баланса, aria-label с долями, ширины по долям, без сумм и без оценок', () => {
  const h = P.polosaBalansaHtml(D({ year: 2025, equity: 18600000, long_debt: 4000000, short_debt: 12900000 }), U);
  assert.match(h, /На чём держится компания/);
  assert.match(h, new RegExp('баланс на' + NB + '31\\.12\\.2025'));
  assert.match(h, /role="img" aria-label="Собственный капитал — 53 %, Долгосрочные обязательства — 11 %, Краткосрочные обязательства — 36 %"/);
  assert.strictEqual((h.match(/style="width:/g) || []).length, 3);
  assert.doesNotMatch(h, /₽/);
  assert.doesNotMatch(h, /надёжн|устойчив|хорош|плох|опасн|гарантир/i);
  assert.match(h, /ГИР БО/);
});

test('нет полосы: капитал меньше нуля, неполный баланс, нет года, всё по нулям', () => {
  assert.strictEqual(P.polosaBalansaHtml(D({ year: 2025, equity: -5, long_debt: 10, short_debt: 10 }), U), '');
  assert.strictEqual(P.polosaBalansaHtml(D({ year: 2025, equity: 10, short_debt: 10 }), U), '');
  assert.strictEqual(P.polosaBalansaHtml(D({ equity: 10, long_debt: 1, short_debt: 1 }), U), '');
  assert.strictEqual(P.polosaBalansaHtml(D({ year: 2025, equity: 0, long_debt: 0, short_debt: 0 }), U), '');
  assert.strictEqual(P.polosaBalansaHtml({}, U), '');
  assert.strictEqual(P.polosaBalansaHtml(null, U), '');
});

test('часть с нулём не рисуется; крошечная доля — «меньше 1 %», а не «0 %»', () => {
  const h = P.polosaBalansaHtml(D({ year: 2024, equity: 999000, long_debt: 0, short_debt: 1000 }), U);
  assert.doesNotMatch(h, /pbal--dol/);
  assert.match(h, new RegExp('<b>меньше' + NB + '1' + NB + '%</b>'));
  assert.match(h, new RegExp('<b>100' + NB + '%</b>'));
});

test('страница: полоса вставляется после выпуска под таблицей раздела 6, закрытый раздел — без неё; стили печати', () => {
  const S = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
  assert.ok(S.includes("if(r6&&r6.status!=='locked'&&s6&&P.polosaBalansaHtml){"));
  assert.ok(S.includes("tb.insertAdjacentHTML('afterend',pb)"));
  assert.match(S, /\.pbal__bar,\.pbal li i\{-webkit-print-color-adjust:exact;print-color-adjust:exact\}/);
  assert.match(S, /\.pbal\{[^}]*break-inside:avoid/);
});
