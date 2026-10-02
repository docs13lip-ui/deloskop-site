// Главная до проверки: карточка-пример тем же листом, что и отчёт (ТЗ [Продукт · Арт-директор] 02.10, разд. 2.5 п. 8).
// node --test tests/glavnaya_primer.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const h = chitat('index.html');
const a = h.indexOf('<div class="report ex"');
const b = h.indexOf('<section class="vhody"', a);
const ex = a >= 0 && b > a ? h.slice(a, b) : '';

test('пример — один блок .report.ex: шапка → полоса вывода → факты → подпись', () => {
  assert.ok(ex, 'нет карточки-примера .report.ex');
  const i = ['class="ex-hd"', 'class="ex-vd', 'data-usl-demo', 'class="ex-f"', 'class="ex-pod"'].map((s) => ex.indexOf(s));
  i.forEach((x, k) => assert.ok(x > 0, 'нет части ' + k));
  for (let k = 1; k < i.length; k++) assert.ok(i[k] > i[k - 1], 'порядок частей примера нарушен');
});

test('ровно 3 существенных факта, у каждого — источник и дата', () => {
  const rows = ex.match(/<div class="row ex-r">[\s\S]*?<\/div>/g) || [];
  assert.strictEqual(rows.length, 3);
  rows.forEach((r) => {
    assert.match(r, /<small>[^<]*(ЕГРЮЛ|ФНС)[^<]*·[^<]*на(?:\u00a0|&nbsp;|\s)дату[^<]*<\/small>/, 'у факта нет «источник · дата»: ' + r);
    assert.match(r, /<b class="d (ok|warn|bad|neutral)">/);
  });
});

test('пример честный: компания вымышленная, числа Индекса нет, без превосходных степеней', () => {
  assert.match(ex, /вымышленн/);
  assert.doesNotMatch(ex, /\/\s*(&nbsp;)?99|Индекс Делоскопа\s*\d/, 'в примере не показываем число Индекса — в ответе API его пока нет');
  assert.doesNotMatch(ex, /лучш|надёжн|гарантир|самый/i);
});

test('первый настоящий отчёт снимает режим примера', () => {
  const r = h.indexOf("report.classList.remove('ex')"), m = h.indexOf("report.innerHTML='<div class=\"report-head\">");
  assert.ok(r > 0 && m > r, 'render() должен снять класс ex до перерисовки');
});

test('стили примера — в css/otchet.css, на 520 px полоса в одну колонку', () => {
  const css = chitat('css/otchet.css');
  ['.report.ex{', '.ex-vd{', '.ex-r{', '.ex-pod{'].forEach((s) => assert.ok(css.includes(s), 'нет ' + s));
  assert.match(css, /@media \(max-width:520px\)\{[\s\S]*?\.ex-vd\{grid-template-columns:minmax\(0,1fr\)/);
  // шрифт не мельче 12 px (правило дизайн-системы)
  (css.match(/\.ex[^{]*\{[^}]*\}/g) || []).forEach((r) => {
    const m = /font-size:(\d+(?:\.\d+)?)px/.exec(r);
    if (m) assert.ok(+m[1] >= 12, 'мельче 12 px: ' + r);
  });
});
