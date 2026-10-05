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

function fakeDoc(readyState) {
  const sl = [];
  return {
    readyState,
    addEventListener(t, f) { if (t === 'DOMContentLoaded') sl.push(f); },
    fire() { this.readyState = 'interactive'; sl.splice(0).forEach((f) => f()); }
  };
}
function zagruzit(doc) {
  const m = HTML.match(/var moduliGotovy=false;[^\n]*\n\s*function kogdaModuli\(f\)\{[^\n]*\}/);
  assert.ok(m, 'в index.html нет kogdaModuli');
  const ctx = { document: doc };
  vm.runInNewContext(m[0] + ';this.kogdaModuli=kogdaModuli;', ctx);
  return ctx.kogdaModuli;
}

test('ответ пришёл до DOMContentLoaded (readyState уже «interactive», defer-модули ещё не исполнены) — рисуем после события', () => {
  const doc = fakeDoc('loading');
  const k = zagruzit(doc);
  doc.readyState = 'interactive'; // разбор закончен, defer-скрипты ещё впереди
  let n = 0;
  k(() => n++);
  assert.strictEqual(n, 0, 'отчёт нарисован до модулей');
  doc.fire();
  assert.strictEqual(n, 1);
});

test('ответ пришёл после DOMContentLoaded — рисуем сразу, один раз', () => {
  const doc = fakeDoc('loading');
  const k = zagruzit(doc);
  doc.fire();
  let n = 0;
  k(() => n++);
  assert.strictEqual(n, 1);
  doc.fire();
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

test('модули отчёта на главной по-прежнему defer, встроенный скрипт проверки — без defer (иначе ?inn= ждал бы ещё дольше)', () => {
  ['usloviya', 'otchet', 'dinamika', 'indeks-otvet', 'sushchestvennoe'].forEach((m) => {
    assert.match(HTML, new RegExp('<script src="/js/' + m + '\\.js" defer></script>'), m);
  });
});
