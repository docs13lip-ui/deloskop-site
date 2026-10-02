// Лист «Отчёт о проверке» на всю ширину (js/otchet.js, css/otchet.css) — макет [Продукт · Арт-директор] 02.10.2026.
// node --test tests/otchet.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/otchet.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

const r = (over) => Object.assign({ company: { inn: '7736050003', status: 'ACTIVE' }, risk_level: 'low', signals: [] }, over || {});

test('нет Индекса в ответе — числа нет, пишем «считаем»; ничего не выдумываем', () => {
  assert.strictEqual(O.indeks(r()), null);
  const h = O.htmlIndeks(r());
  assert.match(h, /Индекс — считаем/);
  assert.doesNotMatch(h, /ot-ix__big|ot-ix__sh|\/\u00a099/);
  assert.doesNotMatch(h, /собрано/, 'без полноты — без строки «собрано»');
  assert.match(O.htmlIndeks(r({ polnota: 0.62 })), /собрано 62\u00a0% данных/);
});

test('Индекс из ответа: 1–99, шкала с маркером, уровень без «надёжн» (222-ФЗ)', () => {
  assert.strictEqual(O.indeks(r({ indeks: 64 })), 64);
  assert.strictEqual(O.indeks(r({ indeks: { znachenie: 71 } })), 71);
  for (const bad of [0, 100, -3, 'много', null, NaN]) assert.strictEqual(O.indeks(r({ indeks: bad })), null, String(bad));
  const h = O.htmlIndeks(r({ indeks: 64 }));
  assert.match(h, /ot-ix__big n">64</);
  assert.match(h, /left:64%/);
  assert.match(h, /Есть вопросы/);
  assert.deepStrictEqual([99, 70, 69, 50, 49, 30, 29, 1].map((n) => O.uroven(n).t),
    ['Без серьёзных сигналов', 'Без серьёзных сигналов', 'Есть вопросы', 'Есть вопросы', 'Есть серьёзные сигналы', 'Есть серьёзные сигналы', 'Много признаков риска', 'Много признаков риска']);
  for (const u of O.UROVNI) assert.doesNotMatch(u[1], /надёжн|надежн/i);
});

test('полоса вывода: цвет по risk_level; одна главная кнопка; Паспорт — только юрлицу', () => {
  assert.strictEqual(O.tonPolosy(r({ risk_level: 'low' })), 'ok');
  assert.strictEqual(O.tonPolosy(r({ risk_level: 'medium' })), 'warn');
  assert.strictEqual(O.tonPolosy(r({ risk_level: 'high' })), 'bad');
  assert.strictEqual(O.tonPolosy(r({ risk_level: undefined })), 'warn');
  const a = O.dejstviya(r());
  assert.strictEqual(a.filter((x) => x.glavnaya).length, 1);
  assert.strictEqual(a[0].t, 'Следить за компанией');
  assert.strictEqual(a[1].href, '/pasport/kontragent/?inn=7736050003');
  assert.strictEqual(O.dejstviya(r({ company: { inn: '770000000012' } })).length, 1, 'ИП — Паспорт не выпускаем');
  const s = O.dejstviya(r(), true);
  assert.deepStrictEqual(s.map((x) => x.t), ['Следить за своей компанией']);
  const g = O.dejstviya(r(), true, { href: '/nalogi/x/', knopka: 'Как снять недостоверность' });
  assert.deepStrictEqual(g.map((x) => x.t), ['Как снять недостоверность'], 'Щит: первый шаг со ссылкой — главным');
});

test('«Как посчитали предел» — текст Usloviya без изменений + оговорка «не норма закона»', () => {
  const U = require('../js/usloviya.js');
  const kak = U.decide(r({ dossier: { kpi: [{ label: 'Выручка за 2025', value: 48.6e6 }] } })).kak;
  const h = O.htmlKak(kak, U.STATYA);
  assert.match(h, /id="ot-kak"/);
  assert.ok(h.includes(kak.kak.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
  assert.match(h, /Ориентир Делоскопа, не норма закона\./);
  assert.strictEqual(O.htmlKak(null), '');
});

test('главная подключает лист: стиль, модуль после terminy.js, вызов после всех модулей отчёта', () => {
  const h = chitat('index.html');
  assert.match(h, /<link rel="stylesheet" href="\/css\/otchet.css">/);
  const iT = h.indexOf('<script src="/js/terminy.js"'), iO = h.indexOf('<script src="/js/otchet.js" defer>');
  assert.ok(iT > 0 && iO > iT);
  const iR = h.indexOf('Otchet.razlozhit(report,r,'), iM = h.lastIndexOf('Terminy.mount(report)');
  assert.ok(iR > iM, 'раскладка — после того, как модули нарисовали свои блоки');
});

test('стили листа: текста мельче 12 px нет; оговорка — та же, что смысл живой строки', () => {
  const c = chitat('css/otchet.css');
  const razmery = [...c.matchAll(/font-size:([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(razmery.length > 5);
  assert.ok(razmery.every((x) => x >= 12), 'мельче 12 px: ' + razmery.filter((x) => x < 12));
  assert.strictEqual(O.OGOVORKA, 'Оценка по открытым данным на дату проверки, а не решение банка или налоговой.');
  assert.doesNotMatch(chitat('js/otchet.js'), /гарантир|лучш|надёжн/i);
});

test('правки [Арт-директора] 13:35: подпись под уровнем и прокрутка к листу', () => {
  const O = require('../js/otchet.js');
  assert.strictEqual(O.POD_PILL, 'по признакам из реестров');
  assert.strictEqual(typeof O.prokrutit, 'function');
  assert.strictEqual(O.prokrutit(null), false);
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(src, /Otchet\.prokrutit\(report\)/);
});
