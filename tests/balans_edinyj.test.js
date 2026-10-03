// balans-edinyj-v1: доли баланса на экране проверки (js/dinamika.js) и в Паспорте (js/pasport-kontragenta.js) — один расчёт.
// ТЗ [Продукт · Арт-директор + Данные] 03.10 13:55, разд. 2: метод наибольшего остатка (сумма 100 %), доли — только при всех трёх частях ≥ 0,
// капитал меньше нуля — полосы нет, «меньше 1 %» вместо «<1 %».
// node --test tests/balans_edinyj.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const P = require('../js/pasport-kontragenta.js');
const NB = '\u00a0';

const otvet = (eq, ld, sd) => ({ company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE' }, risk_level: 'low', signals: [],
  dossier: { charts: { balance: { year: 2025, equity: eq, long_debt: ld, short_debt: sd } } } });
const ekran = (eq, ld, sd) => { const b = D.balans(otvet(eq, ld, sd)); return b && b.polosa ? b.chasti.map((x) => [x.k, x.p]) : null; };
const pasport = (eq, ld, sd) => {
  const s = P.strukturaBalansa(otvet(eq, ld, sd).dossier);
  return s && s.tot > 0 ? s.chasti.filter((x) => x.v > 0).map((x) => [x.k, x.p]) : null;
};
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

test('(а) 240 / 55 / 190 млн ₽ → 50 · 11 · 39 %, сумма 100 — на экране и в Паспорте', () => {
  const e = ekran(240e6, 55e6, 190e6);
  assert.deepStrictEqual(e, [['kap', 50], ['dol', 11], ['kor', 39]]);
  assert.strictEqual(e.reduce((a, x) => a + x[1], 0), 100);
  assert.deepStrictEqual(pasport(240e6, 55e6, 190e6), e);
  const h = tekst(D.htmlBalans(otvet(240e6, 55e6, 190e6)));
  assert.match(h, /Собственный капитал 240,0 млн ₽ 50 % Долгосрочные обязательства 55,0 млн ₽ 11 % Краткосрочные обязательства 190,0 млн ₽ 39 %/);
  // строки раздела 6 Паспорта — те же доли
  const s = P.strukturaBalansa(otvet(240e6, 55e6, 190e6).dossier);
  assert.deepStrictEqual(s.chasti.map((x) => x.p), [50, 11, 39]);
});

test('(б) капитал −31 млн ₽ → на экране нет din__bar, есть din__minus первой строкой; в Паспорте полосы тоже нет', () => {
  const h = D.htmlBalans(otvet(-31e6, 10e6, 60e6));
  assert.doesNotMatch(h, /din__bar/);
  assert.match(h, /<ul class="din__leg"><li class="din__minus">/);
  assert.match(tekst(h), /Собственный капитал −31,0 млн ₽ меньше нуля/);
  assert.strictEqual(P.polosaBalansaHtml(otvet(-31e6, 10e6, 60e6).dossier), '');
});

test('(в) 20 случайных троек: доли экрана = доли Паспорта, сумма 100', () => {
  let seed = 20261003;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 20; i++) {
    const t = [0, 1, 2].map(() => Math.round(rnd() * (rnd() < 0.2 ? 1e6 : 1e10)));
    const e = ekran(...t), p = pasport(...t);
    assert.deepStrictEqual(e, p, 'тройка ' + t.join(' / '));
    if (e) assert.strictEqual(e.reduce((a, x) => a + x[1], 0), 100, 'сумма ' + t.join(' / '));
  }
});

test('«меньше 1 %» вместо «<1 %»; неполный баланс — суммы без долей и без полосы', () => {
  const b = D.balans(otvet(1e12, 1e9, 5e11));
  const dol = b.chasti.find((x) => x.k === 'dol');
  assert.strictEqual(dol.dolya, 'меньше' + NB + '1' + NB + '%');
  assert.doesNotMatch(D.htmlBalans(otvet(1e12, 1e9, 5e11)), /&lt;1|<1/);
  const nep = D.balans(otvet(100e6, null, 50e6));
  assert.strictEqual(nep.polosa, false);
  assert.deepStrictEqual(nep.chasti.map((x) => x.dolya), ['', '']);
  assert.doesNotMatch(D.htmlBalans(otvet(100e6, null, 50e6)), /din__bar|%/);
  assert.strictEqual(pasport(100e6, null, 50e6), null);
});
