// [Ночные-3] pasport-indeks-v1: Паспорт контрагента не застревает на «Индекс — считаем», если методика Индекса
// пришла позже 4 с (gotovo() зовёт и без неё). Рисуем через 4 с, методика пришла — перевыпуск, только если Индекс меняется;
// поле под рукой не выдёргиваем; ?print=1 — печать один раз. node --test tests/pasport_indeks.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'pasport/kontragent/index.html'), 'utf8');
const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
const kusok = skript.slice(skript.indexOf('var TEK=null'), skript.indexOf('  // «На кону» считаем'));

// Мини-браузер: методика «грузится», пока не вызовем zagruzit(); tajmaut() — срабатывание 4 с в gotovo()
function stend(opts) {
  opts = opts || {};
  let gotov = false, zhdut = [];
  const IO = { gotov: () => gotov, gotovo: (f) => { if (gotov) f(); else zhdut.push(f); } };
  const vyzovy = [], polya = [];
  let aktivnyj = null;
  const pk = { hidden: false, contains: (x) => x && x.vPk };
  const document = { get activeElement() { return aktivnyj; }, body: { tagName: 'BODY' } };
  const P = { sobrat: () => ({ meta: { indeks: gotov ? { ball: 'ball' in opts ? opts.ball : 65, sobrano: 80 } : { ball: null, sobrano: 80 } }, razdely: [{ id: 'indeks', prichina: gotov && opts.ball !== null ? '' : 'Индекс — считаем', fakty: [] }] }) };
  const ctx = vm.createContext({ window: { IndeksOtvet: IO }, IndeksOtvet: IO, document, pk, P, JSON, setTimeout: (f) => f() });
  vm.runInContext(kusok + `
    var zapomneno=0; function rsZapomnit(){zapomneno++;}
    function render(r,o){var p=P.sobrat(r,o);TEK={r:r,opts:o,ix:ixKlyuch(p)};vyzovy.push(p.meta.indeks.ball);}
    this.api={zhdatMetodiku:zhdatMetodiku,perevypustit:perevypustit,render:render,vyzovy:vyzovy,zapomneno:function(){return zapomneno;}};`, Object.assign(ctx, { vyzovy }));
  return {
    A: ctx.api, vyzovy,
    zagruzit() { gotov = true; const z = zhdut; zhdut = []; z.forEach((f) => f()); },
    tajmaut() { const z = zhdut; zhdut = []; z.forEach((f) => f()); return z.length; },
    fokus(x) { aktivnyj = x; },
    polya,
  };
}
// Как в странице: zhdatMetodiku(function(){go();zhdatMetodiku(perevypustit,3);},1)
function otkryt(S) { S.A.zhdatMetodiku(function () { S.A.render({}, {}); S.A.zhdatMetodiku(S.A.perevypustit, 3); }, 1); }

test('страница: обычный путь — zhdatMetodiku вместо голого gotovo, печать один раз', () => {
  assert.ok(skript.includes("zhdatMetodiku(function(){go();zhdatMetodiku(perevypustit,3);},1);"));
  assert.ok(skript.includes("if(q.get('print')==='1'){zhdatMetodiku(go,4);return;}"), '?print=1 — ждём методику до первой отрисовки');
  assert.ok(skript.includes("if(q.get('print')==='1'&&!PECHAT){PECHAT=true;"), 'перевыпуск не печатает второй раз');
  assert.ok(!skript.includes('IndeksOtvet.gotovo(go)'));
  assert.ok(skript.includes('TEK={r:r,opts:opts,ix:ixKlyuch(p)};'));
});

test('методика успела за 4 с — одна отрисовка, сразу с баллом', () => {
  const S = stend();
  otkryt(S); assert.deepStrictEqual(S.vyzovy, []);
  S.zagruzit();
  assert.deepStrictEqual(S.vyzovy, [65]);
});

test('методика пришла через 7 с — сначала «считаем», затем перевыпуск с баллом', () => {
  const S = stend();
  otkryt(S);
  assert.strictEqual(S.tajmaut(), 1);
  assert.deepStrictEqual(S.vyzovy, [null], 'через 4 с Паспорт есть, Индекс — «считаем»');
  S.zagruzit();
  assert.deepStrictEqual(S.vyzovy, [null, 65]);
  assert.strictEqual(S.A.zapomneno(), 1, 'заполненное «Решение о сделке» сохранено перед перевыпуском');
});

test('Индекс от методики не меняется (данных мало) — второй раз не перевыпускаем', () => {
  const S = stend({ ball: null });
  otkryt(S); S.tajmaut(); S.zagruzit();
  assert.deepStrictEqual(S.vyzovy, [null]);
});

test('методика не пришла за ~16 с — ждём не бесконечно, Паспорт остаётся как есть', () => {
  const S = stend();
  otkryt(S);
  for (let i = 0; i < 4; i++) assert.strictEqual(S.tajmaut(), 1, 'ожидание ' + (i + 1));
  assert.strictEqual(S.tajmaut(), 0, 'после 4 ожиданий (~16 с) больше не ждём');
  S.zagruzit();
  assert.deepStrictEqual(S.vyzovy, [null]);
});

test('человек в поле суммы — перевыпуск после ухода из поля', () => {
  const S = stend();
  otkryt(S); S.tajmaut();
  let blur = null;
  S.fokus({ tagName: 'INPUT', vPk: true, addEventListener: (t, f) => { assert.strictEqual(t, 'blur'); blur = f; } });
  S.zagruzit();
  assert.deepStrictEqual(S.vyzovy, [null], 'пока в поле — не трогаем');
  S.fokus(null); blur();
  assert.deepStrictEqual(S.vyzovy, [null, 65]);
});
