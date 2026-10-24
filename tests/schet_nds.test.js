// schet-nds-v1: «Проверь счёт» (/proverit-schet/) — НДС и сумма к оплате в счетах с колонками «без НДС».
// Было: заголовок «Цена без НДС» ставил noVat → в назначении платежа «НДС не облагается» на счёте с НДС 22 %,
// сумма к оплате бралась из «Итого без НДС»; «руб. коп.» и узкий пробел не читались; КПП — покупателя.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'proverit-schet', 'index.html'), 'utf8');
const a = html.indexOf('/* ---------- контрольные числа ---------- */');
const b = html.indexOf('/* ---------- вывод ---------- */');
assert.ok(a > 0 && b > a, 'блок разбора найден');
const ctx = { money: (x) => x.toFixed(2) };
vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + ';this.parse=parse;this.localChecks=localChecks;this.pickSeller=pickSeller;this.purpose=purpose;', ctx);
const P = (t) => JSON.parse(JSON.stringify(ctx.parse(t)));
const nds = (t) => { const r = ctx.parse(t); return ctx.localChecks(r, ctx.pickSeller(r)).filter((c) => c.title === 'НДС'); };

const KONTUR = `Счёт № 47 от 21 октября 2026 г.
Поставщик: ООО «Ромашка», ИНН 7707083893, КПП 773601001
Покупатель: ООО «Лютик», ИНН 7736050003, КПП 772801001
№ Наименование Кол-во Ед. Цена без НДС Сумма без НДС Ставка НДС Сумма НДС Сумма с НДС
1 Консультация 1 усл. 81 967,21 81 967,21 22% 18 032,79 100 000,00
Итого без НДС: 81 967,21
НДС: 18 032,79
Итого с НДС: 100 000,00`;

test('колонки «Цена/Сумма без НДС» не делают счёт «без НДС»', () => {
  const r = P(KONTUR);
  assert.strictEqual(r.noVat, false);
  assert.strictEqual(r.vat, 18032.79);
  assert.strictEqual(r.total, 100000);
  const pur = ctx.purpose(ctx.parse(KONTUR));
  assert.doesNotMatch(pur, /не облагается/);
  assert.match(pur, /НДС 22% — 18032\.79/);
  assert.deepStrictEqual([...nds(KONTUR).map((c) => c.st)], ["ok"]);
});

test('настоящий «без НДС» — по-прежнему без НДС', () => {
  for (const t of ['Итого к оплате: 50 000,00 Без налога (НДС)', 'Итого: 50 000,00 НДС не облагается', 'Сумма: 5 000,00. Без НДС']) {
    const r = P(t);
    assert.strictEqual(r.noVat, true, t);
    assert.strictEqual(r.vat, null, t);
    assert.match(ctx.purpose(ctx.parse(t)), /НДС не облагается/, t);
  }
});

test('«Итого» без НДС и «Всего» с НДС — сумма к оплате из «Всего», ложного предупреждения нет', () => {
  const t = 'Поставщик ИНН 7707083893\nИтого: 81 967,21\nНДС 22 %: 18 032,79\nВсего: 100 000,00';
  assert.strictEqual(P(t).total, 100000);
  assert.deepStrictEqual([...nds(t).map((c) => c.st)], ["ok"]);
  assert.strictEqual(P('Всего наименований 1, на сумму 100 000,00 руб.\nВсего к оплате: 100 000,00').total, 100000);
});

test('«руб. коп.», целые рубли и узкий пробел читаются', () => {
  const r = P('Всего к оплате: 100 000 руб. 00 коп., в т.ч. НДС 22% 18 032 руб. 79 коп.');
  assert.strictEqual(r.total, 100000);
  assert.strictEqual(r.vat, 18032.79);
  assert.strictEqual(P('Итого к оплате: 100 000 руб.').total, 100000);
  const q = P('Итого к оплате: 100 000,00 В т.ч. НДС 22%: 18 032,79');
  assert.strictEqual(q.total, 100000);
  assert.strictEqual(q.vat, 18032.79);
  // даты — не суммы
  assert.strictEqual(P('Итого 21.10.2026').total, null);
  assert.strictEqual(P('Итого к оплате 2026-10-24').total, null);
});

test('«Итого с НДС» за сумму НДС не принимается', () => {
  const r = P('Итого с НДС: 100 000,00\nНДС 22%: 18 032,79');
  assert.strictEqual(r.vat, 18032.79);
  assert.strictEqual(r.total, 100000);
});

test('КПП — поставщика, даже если покупатель записан выше', () => {
  const t = 'Плательщик: ООО «Лютик», ИНН 7736050003, КПП 772801001\nПолучатель: ООО «Ромашка», ИНН 7707083893, КПП 773601001';
  assert.strictEqual(P(t).kpp, '773601001');
  assert.strictEqual(P('ИНН/КПП 7707083893/773601001').kpp, '773601001');
  assert.strictEqual(P(KONTUR).kpp, '773601001');
});

test('банк из счёта 1С, скопированного из PDF (название строкой выше «Банк получателя»)', () => {
  assert.strictEqual(P('ПАО СБЕРБАНК Г. МОСКВА\nБанк получателя\nБИК\n044525225').bank, 'ПАО СБЕРБАНК Г. МОСКВА');
  assert.strictEqual(P('Банк получателя: ПАО Сбербанк г. Москва БИК 044525225').bank, 'ПАО Сбербанк г. Москва');
});
