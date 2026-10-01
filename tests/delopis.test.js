// Делопись: пункт о цене по 293-ФЗ (текст — [Право · Налоговый юрист] 01.10.2026) и запрет неподтверждённой пропорции.
// Запуск: node --test tests/delopis.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'delopis', 'index.html'), 'utf8');

test('цена — «с учётом НДС, если он подлежит уплате»', () => {
  assert.ok(html.includes('с учётом НДС, если он подлежит уплате'));
  assert.ok(!html.includes('является его плательщиком'), 'старая формулировка осталась');
});

test('293-ФЗ: 10 рабочих дней на согласование цены, до него — прежняя цена', () => {
  assert.ok(html.includes("по закону появится обязанность платить НДС, стороны в течение 10 рабочих дней письменно согласуют, меняется ли цена. До согласования действует прежняя цена."));
});

test('пропорцию 22/122 не пишем — не сверена для упрощенцев (ставки 5% и 7%)', () => {
  assert.ok(!/22\s*\/\s*122/.test(html));
});

test('пункт стоит внутри раздела «Цена и порядок расчётов»', () => {
  const i = html.indexOf("S('Цена и порядок расчётов'");
  const j = html.indexOf('317.1 ГК РФ', i);
  assert.ok(i > 0 && j > i);
  assert.ok(html.slice(i, j).includes('10 рабочих дней письменно согласуют'));
});
