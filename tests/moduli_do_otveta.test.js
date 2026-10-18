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
  const m = HTML.match(/var moduliGotovy=false;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*var OTCHET_JS=[^\n]*\n\s*function gruzitModuli\(\)\{[^\n]*\}\n\s*function kogdaModuli\(f\)\{[^\n]*\}/);
  assert.ok(m, 'в index.html нет загрузчика пакета и kogdaModuli');
  const ctx = { document: doc, Promise };
  vm.runInNewContext(m[0] + ';this.kogdaModuli=kogdaModuli;this.gruzitModuli=gruzitModuli;', ctx);
  return ctx;
}
const tik = () => new Promise((r) => setImmediate(r));

test('ответ пришёл до DOMContentLoaded — рисуем после события и после пакета модулей', async () => {
  const doc = fakeDoc('loading');
  const k = zagruzit(doc).kogdaModuli;
  doc.readyState = 'interactive';
  let n = 0;
  k(() => n++);
  assert.strictEqual(doc.skripty.length, 1, 'пакет запрошен');
  doc.skripty[0].onload(); await tik();
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
  assert.strictEqual(doc.skripty.length, 1, 'один тег пакета на все вызовы');
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
  doc.skripty[0].onerror(); await tik();
  assert.strictEqual(n, 1);
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
  const m = SYROJ.match(/var OTCHET_JS='(\/js\/b\/otchet\.[0-9a-f]{10}\.js)'/);
  assert.ok(m && fs.existsSync(path.join(__dirname, '..', m[1])), 'адрес пакета');
  // встроенный скрипт проверки — без defer (иначе ?inn= ждал бы ещё дольше); пакет главной — defer
  assert.match(SYROJ, /<script src="\/js\/b\/glavnaya\.[0-9a-f]{10}\.js" defer><\/script>/);
  assert.ok(SYROJ.indexOf('var moduliGotovy=false') > 0 && /<script>\n\(function\(\)\{\n  var form=document\.getElementById\('check'\)/.test(SYROJ));
  // runCheck запрашивает пакет сразу, параллельно с ответом API
  assert.match(SYROJ, /function runCheck\(v,o\)\{\n[^\n]*\n\s*gruzitModuli\(\);/);
});
