// Сверка разборов 05.10.2026 ([Ночные запуски], час глубины): «Сормово» (ВС 17.10.2022 и 27.05.2024 № 301-ЭС22-11144) и
// «Штраф банка» (ВС 04.09.2024 № 305-ЭС24-5195) сверены по текстам актов — расхождений в фактах нет. Держит три правки:
// число минут согласовано («4 минуты чтения»), один номер ВС на два круга не повторяется, условный пример у «Штрафа» не выдаёт
// себя за факт дела (в деле списание было одно — 14.12.2022).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const un = (s) => s.replace(/ /g, ' ').replace(/&nbsp;/g, ' ');
const vse = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
  x.isDirectory() ? vse(path.join(dir, x.name)) : x.name.endsWith('.html') ? [path.join(dir, x.name)] : []);

test('время чтения согласовано с числом на всех страницах практики', () => {
  for (const f of vse(path.join(KOREN, 'praktika'))) {
    const t = un(fs.readFileSync(f, 'utf8'));
    for (const m of t.matchAll(/(\d+) (минут\w*) чтения/g)) {
      const n = +m[1];
      const nado = (n % 10 === 1 && n % 100 !== 11) ? 'минута'
        : ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) ? 'минуты' : 'минут';
      assert.strictEqual(m[2], nado, path.relative(KOREN, f) + ': «' + m[0] + '»');
    }
  }
});

test('«Похожие разборы»: один номер ВС на два круга — без повтора, с датами актов', () => {
  const t = un(fs.readFileSync(path.join(KOREN, 'praktika/index.html'), 'utf8'));
  assert.ok(!t.includes('№ 301-ЭС22-11144 и № 301-ЭС22-11144'));
  assert.ok(t.includes('ВС · 2 акта · № 301-ЭС22-11144 · 17.10.2022 и 27.05.2024'));
});

test('«Штраф банка»: условный пример не выдаёт себя за факт дела', () => {
  const t = un(fs.readFileSync(path.join(KOREN, 'praktika/115-fz/shtraf-banka-za-dokumenty-115-fz/index.html'), 'utf8'));
  assert.ok(!t.includes('Банк списывал 50 000 ₽ штрафа каждый месяц'));
  assert.ok(t.includes('В этом деле банк списал штраф один раз.'));
});
