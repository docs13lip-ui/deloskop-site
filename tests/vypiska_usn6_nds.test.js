// usn6-nds-v1 ([Ночные запуски] 01.11): «Кому вы платите» — УСН 6% с НДС 22%.
// Плательщик УСН, выбравший общую ставку НДС 22%, берёт входной НДС к вычету — его и снимет налоговая
// по ст. 54.1 НК (расходов в налоге нет). Раньше на УСН 6% выписка всегда писала «денег на кону нет».
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const E = require('../kontragenty-iz-vypiski/engine.js');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'kontragenty-iz-vypiski', 'index.html'), 'utf8');

const S = { sum: 1220000, vat: 220000 };   // 1 220 000 ₽ с НДС 22% = 220 000 ₽ НДС

test('режим «УСН 6% с НДС 22%» есть, НДС теряется, налога с расходов нет', () => {
  const r = E.REGIMES.usn6vat;
  assert.ok(r, 'нет режима usn6vat');
  assert.strictEqual(r.vat, true);
  assert.strictEqual(r.base, 0);
  assert.match(r.title, /УСН 6%.*НДС 22%/);
  assert.match(E.REGIMES.usn6.title, /без НДС или 5–7%/, 'УСН 6% без НДС назван явно — иначе выбор неоднозначен');
});

test('деньги на кону: УСН 6% с НДС — вычет + штраф, без НДС — 0', () => {
  const a = E.stake(S, E.REGIMES.usn6vat);
  assert.deepStrictEqual(a, { vat: 220000, tax: 0, soft: 264000, hard: 308000 });   // ×1,2 и ×1,4
  const b = E.stake(S, E.REGIMES.usn6);
  assert.strictEqual(b.hard, 0);
});

test('страница не обещает «на УСН снимать нечего» без оговорки про НДС 22%', () => {
  const t = HTML.replace(/&nbsp;/g, ' ');
  assert.ok(!/На УСН «доходы» снимать нечего</.test(t), 'таблица сценариев');
  assert.ok(!/поэтому денег на кону нет/.test(t), 'абзац о пенях');
  assert.match(t, /С НДС 22% на кону вычет и штраф 20% \(40% — если инспекция докажет умысел\)/);
  // правка [Право · Налоговый юрист] 02.11: не обещаем действие инспекции
  assert.ok(!/снимут вычет/.test(t), '«снимут вычет» → «его могут снять»');
  assert.match(t, /берёте вычет — его могут снять/);
  assert.match(t, /по налогам снимать нечего: ни расходов, ни вычета/);
});

test('подсказка «поставщик без НДС» не пишет «для ОСН» — она и для УСН с НДС', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'kontragenty-iz-vypiski', 'engine.js'), 'utf8');
  assert.ok(!/Для ОСН это минус/.test(src));
});
