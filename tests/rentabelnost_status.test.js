// «Рентабельность активов против отрасли» и «Налоги и взносы против отрасли» — не у компании в банкротстве или ликвидации;
// от 100 % по модулю — без десятых (комплект rentabelnost-status-v1, [Ночные-3] 11.10).
// Повод — ответ /api/check банкрота-холдинга 11.10: «−851,1 … −850,7 % · ниже средней по отрасли · признак отбора на выездную проверку».
// node --test tests/rentabelnost_status.test.js
const test = require('node:test');
const assert = require('node:assert');
const R = require('../js/rentabelnost.js');
const NP = require('../js/nagruzka-proverka.js');

// компания вымышленная; форма — как в живом ответе (charts.balance: equity / long_debt / short_debt)
function otvet(status, o) {
  o = o || {};
  return {
    company: { inn: '7700000001', kind: 'LEGAL', status: status, okved: o.okved || '51.10' },
    dossier: { charts: {
      balance: { year: 2025, equity: o.equity != null ? o.equity : 50e9, long_debt: 30e9, short_debt: 20e9 },
      profit: [{ year: 2025, value: o.pribyl != null ? o.pribyl : 5e9 }],
      income_tax: [{ year: 2025, value: o.nalog != null ? o.nalog : 1e9 }]
    } }
  };
}

test('действующая — оценка есть', () => {
  assert.ok(R.ocenka(otvet('ACTIVE')));
});

test('банкротство, ликвидация, ликвидирована — оценки нет', () => {
  ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED', 'bankrupt'].forEach(st => {
    assert.strictEqual(R.ocenka(otvet(st)), null, st);
    assert.strictEqual(R.raschet(otvet(st), { nagruzka: [], rentabelnost: [] }), null, st);
  });
});

test('реорганизация — оценка остаётся (компания действует)', () => {
  assert.ok(R.ocenka(otvet('REORGANIZING')));
});

test('«Налоги и взносы против отрасли» — тоже не у банкрота и ликвидируемой', () => {
  ['BANKRUPT', 'LIQUIDATING', 'LIQUIDATED'].forEach(st => {
    assert.strictEqual(NP.raschet(otvet(st), { nagruzka: [] }), null, st);
  });
});

test('от 100 % по модулю — целое число, узкий диапазон схлопывается: «−851 %»', () => {
  assert.strictEqual(R.znachenie({ nMin: -851.1, nMax: -850.7 }), '−851 %');
  assert.strictEqual(R.znachenie({ nMin: -851.6, nMax: -850.2 }), '−852 … −850 %');
  assert.strictEqual(R.znachenie({ n: 123.44 }), '123 %');
});

test('до 100 % — как было, с десятыми', () => {
  assert.strictEqual(R.znachenie({ nMin: 9.24, nMax: 17.2 }), '9,2–17,2 %');
  assert.strictEqual(R.znachenie({ n: 13 }), '13,0 %');
  assert.strictEqual(R.znachenie({ nMin: -2.04, nMax: 4.3 }), '−2,0 … 4,3 %');
});

test('список статусов — тот же, что «не действует» в Условиях сделки', () => {
  const fs = require('node:fs'), path = require('node:path');
  const u = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  R.NE_DEJSTVUET.forEach(st => assert.ok(u.indexOf("f.status === '" + st + "'") >= 0, st));
});
