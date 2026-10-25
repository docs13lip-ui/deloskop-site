// moduli-do-otveta-v1 (05.10.2026, [Ночные-3]): отчёт на главной рисуется только после defer-модулей.
// Найдено отрисовкой живого ответа /api/check в Chromium: проверка по ?inn=… (карточки /company/, «Проверить снова»
// из кабинета) стартует из встроенного скрипта до исполнения defer-модулей; быстрый ответ API рисовался без
// Usloviya / Otchet / Dinamika / IndeksOtvet — без вывода, предела предоплаты, Индекса и «Динамики».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SRAVNIT = fs.readFileSync(path.join(__dirname, '..', 'sravnit', 'index.html'), 'utf8'); // как на диске — до razvernut_sborku

// vizual-v3.0a (18.10): модули отчёта на главной — один пакет js/b/otchet.<отпечаток>.js, который страница грузит сама
// (gruzitModuli): при проверке, при намерении проверить и когда браузер свободен. kogdaModuli ждёт и пакет, и DOMContentLoaded.
function fakeDoc(readyState) {
  const sl = [], skripty = [];
  return {
    readyState, skripty,
    head: { appendChild(s) { skripty.push(s); } },
    createElement(tag) { return { tag }; },
    addEventListener(t, f) { if (t === 'DOMContentLoaded') sl.push(f); },
    fire() { this.readyState = 'interactive'; sl.splice(0).forEach((f) => f()); }
  };
}
function zagruzit(doc) {
  // primer-legkij-v1 (25.10): загрузчик — два пакета: «primer» (пример «Условий сделки») и «otchet»; kogdaModuli ждёт оба
  const m = HTML.match(/var moduliGotovy=false;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*var PRIMER_JS=[^\n]*\n(?:\s*function (?:teg|gruzitPrimer|gruzitModuli|kogdaGotovo|kogdaModuli|kogdaPrimer)\([^)]*\)\{[^\n]*\}\n){6}/);
  assert.ok(m, 'в index.html нет загрузчика пакетов и kogdaModuli');
  const ctx = { document: doc, Promise };
  vm.runInNewContext(m[0] + ';this.kogdaModuli=kogdaModuli;this.gruzitModuli=gruzitModuli;this.kogdaPrimer=kogdaPrimer;this.gruzitPrimer=gruzitPrimer;', ctx);
  return ctx;
}
const tik = () => new Promise((r) => setImmediate(r));

test('ответ пришёл до DOMContentLoaded — рисуем после события и после пакета модулей', async () => {
  const doc = fakeDoc('loading');
  const k = zagruzit(doc).kogdaModuli;
  doc.readyState = 'interactive';
  let n = 0;
  k(() => n++);
  assert.strictEqual(doc.skripty.length, 2, 'пакеты primer и otchet запрошены');
  doc.skripty.forEach((s) => s.onload()); await tik();
  assert.strictEqual(n, 0, 'отчёт нарисован до DOMContentLoaded');
  doc.fire();
  assert.strictEqual(n, 1);
});

test('ответ пришёл после DOMContentLoaded — рисуем, как только пришёл пакет, один раз; пакет запрашивается один раз', async () => {
  const doc = fakeDoc('loading');
  const ctx = zagruzit(doc);
  doc.fire();
  ctx.gruzitModuli(); ctx.gruzitModuli();
  let n = 0;
  ctx.kogdaModuli(() => n++);
  await tik();
  assert.strictEqual(n, 0, 'пакет ещё не пришёл');
  assert.strictEqual(doc.skripty.length, 2, 'по одному тегу каждого пакета на все вызовы');
  doc.skripty[1].onload(); await tik();
  assert.strictEqual(n, 0, 'пришёл только otchet — ждём primer (в нём Usloviya)');
  doc.skripty[0].onload(); await tik();
  assert.strictEqual(n, 1);
  doc.fire(); await tik();
  assert.strictEqual(n, 1);
});

test('пакет не загрузился (сеть) — отчёт всё равно рисуется, как раньше без модулей', async () => {
  const doc = fakeDoc('loading');
  const ctx = zagruzit(doc);
  doc.fire();
  let n = 0;
  ctx.kogdaModuli(() => n++);
  doc.skripty.forEach((s) => s.onerror()); await tik();
  assert.strictEqual(n, 1);
});

test('primer-legkij-v1: пример «Условий сделки» грузит только лёгкий пакет primer, порядок тегов — primer раньше otchet', async () => {
  const doc = fakeDoc('loading');
  const ctx = zagruzit(doc);
  doc.fire();
  let n = 0;
  ctx.kogdaPrimer(() => n++); ctx.gruzitPrimer();
  assert.strictEqual(doc.skripty.length, 1, 'для примера — один пакет');
  assert.match(doc.skripty[0].src, /^\/js\/b\/primer\.[0-9a-f]{10}\.js$/);
  assert.strictEqual(doc.skripty[0].async, false);
  doc.skripty[0].onload(); await tik();
  assert.strictEqual(n, 1);
  ctx.gruzitModuli();
  assert.strictEqual(doc.skripty.length, 2, 'primer второй раз не запрашивается');
  assert.match(doc.skripty[1].src, /^\/js\/b\/otchet\.[0-9a-f]{10}\.js$/);
  assert.strictEqual(doc.skripty[1].async, false, 'async=false — исполняется после primer');
});

test('primer-legkij-v1: «Условия сделки» с зависимостями — только в пакете primer; пример на главной вызывается через kogdaPrimer; /sravnit/ — primer тегом раньше otchet', () => {
  const { KARTA } = require('./razvernut_sborku.js');
  // Usloviya при расчёте спрашивает Sushchestvennoe (год отчётности) и StatusKod (код статуса) — они в том же лёгком пакете, раньше неё
  assert.deepStrictEqual(KARTA.pakety.primer, ['js/sushchestvennoe.js', 'js/status-kod.js', 'js/usloviya.js']);
  KARTA.pakety.primer.forEach((f) => assert.ok(!KARTA.pakety.otchet.includes(f), f + ' — в двух пакетах'));
  assert.ok(KARTA.stranicy['index.html'].indexOf('primer') >= 0 && KARTA.stranicy['sravnit/index.html'].indexOf('primer') >= 0);
  assert.ok(!/kogdaModuli\(primerUslovij\)/.test(HTML), 'пример не должен тянуть весь отчёт');
  assert.strictEqual((HTML.match(/kogdaPrimer\(primerUslovij\)/g) || []).length, 3);
  const S = SRAVNIT;
  const a = S.search(/<script src="\/js\/b\/primer\.[0-9a-f]{10}\.js" defer><\/script>/), b = S.search(/<script src="\/js\/b\/otchet\.[0-9a-f]{10}\.js" defer><\/script>/);
  assert.ok(a > 0 && b > a, '/sravnit/: primer раньше otchet');
});

test('runCheck: обработка ответа API (лимит, ошибка, render) — внутри kogdaModuli; render зовётся только там', () => {
  const i = HTML.indexOf('function runCheck(');
  assert.ok(i > 0);
  const kusok = HTML.slice(i, HTML.indexOf('\n  }\n', i));
  assert.match(kusok, /\.then\(function\(x\)\{kogdaModuli\(function\(\)\{report\.classList\.remove\('loading'\);/);
  const vyzovy = HTML.match(/[^\w.]render\(x\.j,o\)/g) || [];
  assert.strictEqual(vyzovy.length, 1);
  assert.ok(kusok.indexOf('kogdaModuli(') < kusok.indexOf('render(x.j,o)'));
  // флаг ставится встроенным скриптом при разборе — раньше любого ответа API
  assert.ok(HTML.indexOf('var moduliGotovy=false') < i);
});

test('главная: модули отчёта не грузятся до проверки — ни тегом, ни пакетом; адрес пакета в загрузчике — текущий', () => {
  const { KARTA } = require('./razvernut_sborku.js');
  const SYROJ = HTML; // HTML прочитан до подмены чтения — как лежит на диске
  KARTA.pakety.otchet.forEach((f) => assert.ok(!SYROJ.includes('<script src="/' + f + '"'), f));
  assert.ok(!/<script src="\/js\/b\/otchet\./.test(SYROJ), 'пакет отчёта тегом');
  const m = SYROJ.match(/OTCHET_JS='(\/js\/b\/otchet\.[0-9a-f]{10}\.js)'/);
  assert.ok(m && fs.existsSync(path.join(__dirname, '..', m[1])), 'адрес пакета');
  const mp = SYROJ.match(/var PRIMER_JS='(\/js\/b\/primer\.[0-9a-f]{10}\.js)'/);
  assert.ok(mp && fs.existsSync(path.join(__dirname, '..', mp[1])), 'адрес пакета primer');
  assert.ok(!/<script src="\/js\/b\/primer\./.test(SYROJ), 'primer на главной — не тегом, а после load');
  // встроенный скрипт проверки — без defer (иначе ?inn= ждал бы ещё дольше); пакет главной — defer
  assert.match(SYROJ, /<script src="\/js\/b\/glavnaya\.[0-9a-f]{10}\.js" defer><\/script>/);
  assert.ok(SYROJ.indexOf('var moduliGotovy=false') > 0 && /<script>\n\(function\(\)\{\n  var form=document\.getElementById\('check'\)/.test(SYROJ));
  // runCheck запрашивает пакет сразу, параллельно с ответом API
  assert.match(SYROJ, /function runCheck\(v,o\)\{\n[^\n]*\n\s*gruzitModuli\(\);/);
});
