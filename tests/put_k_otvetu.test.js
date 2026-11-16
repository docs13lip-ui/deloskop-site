// put-k-otvetu-v1 (16.11.2026, ✎ Штаба 16.11 п. 5): путь «строка → ответ» на телефоне 390 px.
// 1) Проверка началась — подсказки закрыты, поздний ответ /api/suggest их не открывает, на телефоне клавиатура убрана.
// 2) Мини-опрос «Чего не хватает Делоскопу?» — через 30 с после показанного ответа, а не через 8 с после нажатия.
// 3) Окно опроса на 390 px — во всю ширину с полями 16 px, а не столбиком в пол-экрана.
// node --test tests/put_k_otvetu.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function telo(imya) {
  const i = h.indexOf('function ' + imya + '(');
  assert.ok(i > 0, 'нет функции ' + imya);
  let k = h.indexOf('{', i), g = 0, j = k;
  for (; j < h.length; j++) { if (h[j] === '{') g++; else if (h[j] === '}' && --g === 0) break; }
  return h.slice(i, j + 1);
}

test('runCheck в самом начале закрывает подсказки и откладывает опрос', () => {
  const r = telo('runCheck');
  const z = r.indexOf('zakrytPodskazki()'), f = r.indexOf('zaprosProverki('); // skorost-otveta-v1: запрос /api/check — через zaprosProverki (срок и повтор)
  assert.ok(z > 0 && f > z, 'zakrytPodskazki() должна стоять до запроса /api/check');
  assert.ok(r.indexOf('clearTimeout(oprosT)') > 0 && r.indexOf('clearTimeout(oprosT)') < f, 'новая проверка должна откладывать опрос');
});

test('zakrytPodskazki: таймер подсказок снят, поздний ответ отброшен, список скрыт, клавиатура — только на сенсорном экране', () => {
  const z = telo('zakrytPodskazki');
  assert.match(z, /clearTimeout\(tmr\)/);
  assert.match(z, /lastQ='\\u0000'/, 'поздний ответ /api/suggest сверяется с lastQ — его нужно «испортить»');
  assert.match(z, /hide\(\)/);
  assert.match(z, /\(hover:none\) and \(pointer:coarse\)/);
  assert.match(z, /input\.blur\(\)/);
  // поздний ответ подсказок действительно сверяется с lastQ
  assert.match(h, /if\(lastQ!==input\.value\.trim\(\)\)return;items=P\.otvet/);
});

test('zakrytPodskazki на деле: телефон — blur, компьютер — фокус остаётся; ответ подсказок после неё не открывает список', () => {
  for (const tel of [true, false]) {
    const log = [];
    const input = { value: '7707083893', blur() { log.push('blur'); } };
    const ctx = {
      tmr: 5, lastQ: '7707083893', input, log,
      hide() { log.push('hide'); }, clearTimeout(x) { log.push('ct' + x); },
      document: { activeElement: input },
      window: { matchMedia: 1 }, matchMedia: () => ({ matches: tel }),
    };
    vm.createContext(ctx);
    vm.runInContext(telo('zakrytPodskazki') + ';zakrytPodskazki();', ctx);
    assert.deepStrictEqual(log, tel ? ['ct5', 'hide', 'blur'] : ['ct5', 'hide']);
    assert.notStrictEqual(ctx.lastQ, '7707083893');
  }
});

test('опрос: старого «через 8 секунд после submit» нет; есть «после ответа», 30 с', () => {
  assert.doesNotMatch(h, /askLater/);
  assert.doesNotMatch(h, /\},8000\);/);
  assert.match(h, /var OPROS_MS=30000,OPROS_DNEJ=30,oprosT=0;/);
  const r = telo('runCheck');
  const g = r.indexOf("'Готово. Отчёт — рядом.'"), o = r.indexOf('oprosPosle()');
  assert.ok(g > 0 && o > g, 'опрос — только в ветке готового ответа');
  assert.match(r, /if\(!\(o&&\(o\.primer\|\|o\.svoj\)\)\)oprosPosle\(\)/, 'пример и своя компания — без опроса');
  assert.ok(r.indexOf('oprosPosle()') > r.lastIndexOf('note.textContent=(x.j&&x.j.detail)'), 'ошибка — без опроса');
  assert.ok(r.indexOf('.catch(') > o, 'catch (сервис не ответил) идёт после — опроса в нём нет');
  assert.doesNotMatch(r.slice(r.indexOf('.catch(')), /oprosPosle/);
});

test('oprosMozhno: условия показа', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext('var OPROS_DNEJ=30;' + telo('oprosMozhno'), ctx);
  const D = 864e5, now = 100 * D;
  const ok = { vidno: true, pechataet: false, panel: false, cookies: false, seychas: now, bylo: 0 };
  assert.strictEqual(ctx.oprosMozhno(ok), true);
  assert.strictEqual(ctx.oprosMozhno({ ...ok, bylo: now - 29 * D }), false, 'реже раза в 30 дней');
  assert.strictEqual(ctx.oprosMozhno({ ...ok, bylo: now - 30 * D }), true);
  assert.strictEqual(ctx.oprosMozhno({ ...ok, vidno: false }), false, 'вкладка скрыта');
  assert.strictEqual(ctx.oprosMozhno({ ...ok, pechataet: true }), false, 'человек печатает');
  assert.strictEqual(ctx.oprosMozhno({ ...ok, panel: true }), false, 'форма отзыва уже открыта');
  assert.strictEqual(ctx.oprosMozhno({ ...ok, cookies: true }), false, 'строка cookies ещё стоит — второе окно поверх отчёта не ставим');
  assert.strictEqual(ctx.oprosMozhno(null), false);
});

test('«раз в 30 дней» тратится только когда окно и правда показано', () => {
  const p = telo('oprosPosle');
  const proverka = p.indexOf('if(!oprosMozhno('), zapis = p.indexOf("localStorage.setItem('fbAsked'");
  assert.ok(proverka > 0 && zapis > proverka, 'fbAsked пишется после проверки условий');
  assert.match(p, /\},OPROS_MS\); \}$/);
});

test('окно опроса на телефоне — с полями 16 px, а не от середины экрана', () => {
  const css = (h.match(/\.fb-toast\{[^}]*\}/) || [''])[0];
  assert.match(css, /left:16px;right:16px;margin:0 auto/);
  assert.doesNotMatch(css, /left:50%|translateX/);
  assert.match(css, /max-width:min\(600px,calc\(100vw - 32px\)\)/);
});
