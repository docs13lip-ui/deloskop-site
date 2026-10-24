// schet-inn-v1: «Проверь счёт» (/proverit-schet/) — разбор счёта в браузере.
// ИНН группами после слова «ИНН» не теряется (раньше — ложный «Стоп: не платите»),
// суммы вида «118000-00» читаются, название банка — без «Р/с …» и хвостовой пунктуации.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'proverit-schet', 'index.html'), 'utf8');
const a = html.indexOf('/* ---------- контрольные числа ---------- */');
const b = html.indexOf('/* ---------- проверки ---------- */');
assert.ok(a > 0 && b > a, 'блок разбора найден');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + ';this.parse=parse;this.innOk=innOk;', ctx);
const P = (t) => JSON.parse(JSON.stringify(ctx.parse(t)));
const inns = (t) => P(t).inns.map((x) => x.inn);

test('ИНН группами после «ИНН» — находится, с верной контрольной цифрой', () => {
  for (const t of ['ИНН 7707 083 893 КПП 773601001', 'ИНН: 7707-083-893', 'ИНН № 7707 0838 93, р/с', 'ИНН/КПП 7707 083 893 / 773601001']) {
    const r = P(t);
    assert.deepStrictEqual(r.inns.map((x) => x.inn), ['7707083893'], t);
    assert.ok(r.inns[0].ok && r.inns[0].labeled, t);
  }
  assert.deepStrictEqual(inns('Получатель ИП Иванов, ИНН 5001 0073 2259'), ['500100732259']);
});

test('ИНН группами с опечаткой — помечен ошибкой, а не потерян', () => {
  const r = P('ИНН 7707 083 894');
  assert.deepStrictEqual(r.inns.map((x) => [x.inn, x.ok]), [['7707083894', false]]);
});

test('без слова «ИНН» группы цифр ИНН не порождают; слитный ИНН — как раньше', () => {
  assert.deepStrictEqual(inns('Сумма 7707 083 893 руб.'), []);
  assert.deepStrictEqual(inns('ИНН 7707083893 КПП 773601001'), ['7707083893']);
  assert.deepStrictEqual(inns('ИНН/КПП 7707083893/773601001'), ['7707083893']);
  // ИНН и КПП через пробел — КПП не приклеивается
  assert.deepStrictEqual(inns('ИНН 7707083893 773601001'), ['7707083893']);
});

test('два ИНН (поставщик и покупатель) — порядок по тексту, роли на месте', () => {
  const r = P('Поставщик: ООО «А», ИНН 7707 083 893\nПокупатель: ИП Б, ИНН 500100732259');
  assert.deepStrictEqual(r.inns.map((x) => [x.inn, x.role]), [['7707083893', 'seller'], ['500100732259', 'buyer']]);
});

test('суммы «118000-00» и НДС в скобках читаются', () => {
  const r = P('Всего к оплате 118000-00, НДС (20%) 19666-67');
  assert.strictEqual(r.total, 118000);
  assert.strictEqual(r.vat, 19666.67);
  assert.strictEqual(r.vatRate, 20);
  const q = P('Итого к оплате: 120 000,00 руб. В том числе НДС 22%: 21 639,34 руб.');
  assert.strictEqual(q.total, 120000);
  assert.strictEqual(q.vat, 21639.34);
});

test('дата после «Итого» за сумму не принимается', () => {
  assert.strictEqual(P('Итого к оплате 2026-10-24').total, null);
});

test('название банка — без «Р/с …» и хвостовой запятой', () => {
  assert.strictEqual(P('Р/с 40702810938000000001 в ПАО Сбербанк, БИК 044525225').bank, 'ПАО Сбербанк');
  assert.match(P('Банк получателя ПАО Сбербанк г. Москва БИК 044525225').bank, /^ПАО Сбербанк/);
});
