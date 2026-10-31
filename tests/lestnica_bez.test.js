// «Без признака „…“ — ступень N» под расчётом в статье о документах по сумме сделки (Очередь п. 436).
// Держит: строки считаются тем же stupen(), показываются только при настоящем снижении, без обещаний исхода.
// Запуск: node --test tests/lestnica_bez.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../js/lestnica.js');
const nb = t => t.replace(/\u00a0/g, ' ');
const KOREN = path.join(__dirname, '..');

test('один признак поднял ступень — строка с его названием и ступенью без него', () => {
  const r = L.bezPriznakov({ summa: 500000, priznaki: ['predoplata'] });
  assert.strictEqual(r.n, 3);
  assert.deepStrictEqual(r.stroki.map(nb), ['Без признака «Предоплата больше половины суммы» — ступень 2 из 4.']);
});

test('два признака: снять один — ничего не меняет, строка только «без обоих»', () => {
  const r = L.bezPriznakov({ summa: 500000, priznaki: ['predoplata', 'pervaya'] });
  assert.strictEqual(r.bez.length, 0);
  assert.deepStrictEqual(r.stroki.map(nb), ['Без обоих отмеченных признаков — ступень 2 из 4.']);
});

test('три признака: одинаковые снижения свёрнуты в одну строку + «без всех»', () => {
  const r = L.bezPriznakov({ summa: 500000, priznaki: ['predoplata', 'pervaya', 'cena'] });
  assert.deepStrictEqual(r.stroki.map(nb), ['Без любого одного из отмеченных признаков — ступень 3 из 4.', 'Без всех отмеченных признаков — ступень 2 из 4.']);
});

test('ступень по сумме уже высшая или признаков нет — строк нет', () => {
  assert.deepStrictEqual(L.bezPriznakov({ summa: 20000000, priznaki: ['cena'] }).stroki, []);
  assert.deepStrictEqual(L.bezPriznakov({ summa: 500000 }).stroki, []);
  assert.deepStrictEqual(L.bezPriznakov({ summa: '' , priznaki: ['cena'] }).stroki, []);
});

test('каждая строка = stupen() без этого признака (один источник правды)', () => {
  const ids = L.PRIZNAKI.map(p => p[0]);
  for (const summa of [50000, 500000, 5000000]) for (let m = 1; m < 64; m++) {
    const pr = ids.filter((_, i) => m & (1 << i));
    const r = L.bezPriznakov({ summa, priznaki: pr });
    for (const b of r.bez) {
      assert.strictEqual(b.n, L.stupen({ summa, priznaki: pr.filter(x => x !== b.id) }).n);
      assert.ok(b.n < r.n);
    }
    for (const t of r.stroki) assert.ok(!/гарант|суд примет|достаточно|хватит/i.test(t), t);
  }
});

test('статья показывает строки: класс ls-bez в стилях и в расчёте', () => {
  const S = fs.readFileSync(path.join(KOREN, 'nalogi/dokumenty-kontragenta-po-summe-sdelki/index.html'), 'utf8');
  const J = fs.readFileSync(path.join(KOREN, 'js/lestnica-statya.js'), 'utf8');
  assert.ok(S.includes('.ls-bez{'));
  assert.ok(J.includes('bezPriznakov') && J.includes('ls-bez'));
});
