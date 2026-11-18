// oglavlenie-otcheta-v1: строка разделов отчёта по ИНН на телефоне (план 18.11, разд. 3 п. (г)).
// node --test tests/oglavlenie_otcheta.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const O = require('../js/oglavlenie-otcheta.js');
const kor = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(kor, f), 'utf8');

const r = (podpis, top, h) => ({ podpis, top, h: h == null ? 100 : h });

test('punkty: по порядку на странице, без скрытых и повторов', () => {
  const p = O.punkty([r('Реквизиты', 9000), r('Главное', 480), r('Вывод', 1400), r('Скрытый', 3000, 0), r('Вывод', 1500), r('Финансы', 7600)]);
  assert.deepStrictEqual(p.map((x) => x.podpis), ['Главное', 'Вывод', 'Финансы', 'Реквизиты']);
});

test('punkty: меньше трёх разделов — строка не нужна', () => {
  assert.deepStrictEqual(O.punkty([r('Главное', 0), r('Вывод', 10)]), []);
  assert.deepStrictEqual(O.punkty(null), []);
  assert.deepStrictEqual(O.punkty([r('А', NaN), r('Б', 1), r('В', 2)]), []);
});

test('aktivnyj: последний раздел, чей верх прошёл линию; до первого — первый', () => {
  const p = O.punkty([r('А', 500), r('Б', 1500), r('В', 4000)]);
  assert.strictEqual(O.aktivnyj(p, 100), 0);
  assert.strictEqual(O.aktivnyj(p, 1500), 1);
  assert.strictEqual(O.aktivnyj(p, 3999), 1);
  assert.strictEqual(O.aktivnyj(p, 99999), 2);
  assert.strictEqual(O.aktivnyj([], 10), 0);
});

test('каждый раздел строки есть в модулях листа — переименование класса не пройдёт молча', () => {
  const vse = fs.readdirSync(path.join(kor, 'js')).filter((f) => f.endsWith('.js') && f !== 'oglavlenie-otcheta.js')
    .map((f) => chit('js/' + f)).join('\n') + chit('index.html');
  O.RAZDELY.forEach(([sel, podpis]) => {
    const imya = sel.slice(1);
    const re = sel[0] === '#' ? new RegExp('id="' + imya + '"|\\.id = \'' + imya + '\'') : new RegExp('class="(?:[^"]*\\s)?' + imya + '(?=[\\s"])|el\\((?:doc, )?\'[a-z]+\', \'(?:[^\']*\\s)?' + imya + '(?=[\\s\'])');
    assert.ok(re.test(vse), sel + ' («' + podpis + '») не найден в js/');
    assert.ok(podpis.length <= 18, 'подпись короткая: ' + podpis);
  });
});

test('стиль: только телефон и планшет, скрыта на печати, цвета — через переменные, кегль 15 px, нажатие 44 px', () => {
  const c = O.CSS;
  assert.match(c, /@media \(max-width:860px\)\{\.og1\{display:block\}\}/);
  assert.match(c, /@media print\{\.og1\{display:none!important\}\}/);
  assert.match(c, /prefers-reduced-motion:reduce/);
  assert.match(c, /visibility:hidden/);
  assert.match(c, /min-height:44px/);
  assert.match(c, /font-size:15px/);
  const bezVar = c.replace(/var\(--[a-z0-9-]+,#[0-9A-Fa-f]{3,6}\)/g, '').replace(/#000/g, '');
  assert.ok(!/#[0-9A-Fa-f]{3,6}\b/.test(bezVar), 'цвет числом без var(): ' + (bezVar.match(/#[0-9A-Fa-f]{3,6}\b/) || [])[0]);
});

test('подключено: пакет отчёта и главная — после всех разделов, своя компания — без строки', () => {
  const s = JSON.parse(chit('partials/sborka.json'));
  assert.ok(JSON.stringify(s).includes('js/oglavlenie-otcheta.js'));
  const ix = chit('index.html');
  const i = ix.indexOf('DlkOglavlenie.mount(report)'), g = ix.indexOf('DlkGolos.posleProverki(report');
  assert.ok(i > 0 && g > 0 && i > g, 'mount — последним в отрисовке отчёта');
  assert.match(ix, /if\(svoj\)DlkOglavlenie\.snyat\(\);else DlkOglavlenie\.mount\(report\)/);
  const m = ix.match(/OTCHET_JS='(\/js\/b\/otchet\.[0-9a-f]+\.js)'/);
  assert.ok(m && chit(m[1].slice(1)).includes('DlkOglavlenie'), 'модуль в собранном пакете отчёта');
});

test('без DOM mount не падает', () => {
  assert.strictEqual(O.mount(null), null);
  assert.strictEqual(O.mount({ querySelector: () => null }), null);
  O.snyat();
});
