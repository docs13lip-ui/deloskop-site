// beta-odna-stroka-v1 + shapka-plotnee-v1 (ТЗ [Продукт] 23.10, claude/Продукт_интенсив_23.10.md, Д3 и Д5).
// Д3: на телефоне полоса беты — одна строка 44 px (<summary>), полный текст — слово в слово в том же <details>;
//     на широком экране <details> открыт инлайн-скриптом до первой отрисовки — вид прежний.
// Д5: шапка при прокрутке — 94 % от фона темы (было 72 %: текст полосы читался сквозь шапку).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const KOREN = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const sobrat = (args) => JSON.parse(execFileSync('python3', ['-c',
  'import sys,json;sys.path.insert(0,"tests");import beta as B;print(json.dumps([' + args + ']))'], { cwd: KOREN, encoding: 'utf8' }));

test('Д3: короткая строка в <summary>, полный текст режима — внутри того же <details>, байт в байт', () => {
  const [a, b, c, g] = sobrat('B.polosa_sobrat(True,"2026-10-13"),B.polosa_sobrat(True,None),B.polosa_sobrat(False,"2026-10-13"),B.gost_v_den()');
  const tekstB = chit('partials/beta-b.html').trim().replace('{{G}}', String(g));
  assert.ok(b.includes('<details class="beta-bar__d" data-beta-d><summary class="beta-bar__kr"><span><span class="beta-kr-d">Без входа&nbsp;— ' + g + '&nbsp;проверок в&nbsp;день</span><span class="beta-kr-k">Без входа&nbsp;— ' + g + '&nbsp;в&nbsp;день</span></span></summary><p class="beta-bar__t">' + tekstB + '</p></details>'));
  assert.ok(a.includes('<summary class="beta-bar__kr"><span>Всё бесплатно по&nbsp;13&nbsp;октября включительно</span></summary>'));
  // A → B в полночь: и полный текст, и короткая строка лежат запасом
  assert.ok(a.includes('<template data-beta-b-kr><span class="beta-kr-d">Без входа&nbsp;— ' + g + '&nbsp;проверок в&nbsp;день</span><span class="beta-kr-k">Без входа&nbsp;— ' + g + '&nbsp;в&nbsp;день</span></template>'));
  assert.ok(c.includes('<span>Быстрая проверка&nbsp;— бесплатно, ' + g + '&nbsp;в&nbsp;день</span>'));
  for (const s of [a, b, c]) assert.strictEqual((s.match(/<details/g) || []).length, 1);
});

test('Д3: инлайн-скрипт открывает <details> только на широком экране; A → B меняет и короткую строку', () => {
  const kod = chit('partials/beta.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const prog = (uzko, rezhim) => {
    const det = { open: false }, kr = { innerHTML: 'A-kr' }, tekst = { innerHTML: 'A' };
    const bar = { hidden: false, at: { 'data-beta-rezhim': rezhim, 'data-beta-do': '2026-10-13' },
      getAttribute(k) { return this.at[k]; }, setAttribute(k, v) { this.at[k] = v; },
      querySelector: (s) => ({ '.beta-bar__t': tekst, 'template[data-beta-b]': { innerHTML: 'B' },
        'template[data-beta-b-kr]': { innerHTML: 'B-kr' }, '.beta-bar__kr>span': kr })[s] || null };
    const document = { querySelector: (s) => (s === '[data-beta-bar] [data-beta-d]' ? det : bar) };
    const matchMedia = (q) => ({ matches: q === '(max-width:640px)' && uzko });
    vm.runInNewContext(kod, { document, matchMedia, localStorage: { getItem: () => null }, Date });
    return { open: det.open, kr: kr.innerHTML, tekst: tekst.innerHTML };
  };
  assert.strictEqual(prog(false, 'b').open, true);
  assert.strictEqual(prog(true, 'b').open, false);
  assert.deepStrictEqual(prog(true, 'a'), { open: false, kr: 'B-kr', tekst: 'B' }); // 13.10 давно прошёл
});

test('Д3: CSS — строка 44 px на ≤ 640 px, на широком экране <summary> виден только у закрытого <details> (без JS)', () => {
  const css = chit('partials/shapka.css');
  assert.ok(/\.beta-bar \.beta-bar__kr\{display:none;[^}]*min-height:44px/.test(css));
  assert.ok(css.includes('.beta-bar .beta-bar__d:not([open])>.beta-bar__kr{display:flex}'));
  assert.ok(/@media \(max-width:640px\)\{\.beta-bar \.beta-bar__kr\{display:flex\}/.test(css));
  assert.ok(css.includes('.beta-bar .beta-bar__d>.beta-bar__t{margin:0!important}'));
  // собранная страница несёт то же
  const glav = chit('index.html');
  assert.strictEqual((glav.match(/data-beta-d>/g) || []).length, 1);
});

test('Д5: шапка при прокрутке — 94 % фона темы (не 72 %), стекло без числовых цветов', () => {
  const g = chit('css/glubina.css');
  assert.ok(g.includes('.shapka.is-scrolled{background:color-mix(in srgb,var(--bg) 94%,transparent);'));
  assert.ok(!/\.shapka\.is-scrolled\{background:rgba\(/.test(g));
  assert.ok(!/\.shapka\.is-scrolled\{background:rgba\(17,17,19,0\.72\)/.test(chit('css/tema.css')));
  assert.ok(chit('partials/shapka.css').includes(' .shapka{background:color-mix(in srgb,var(--bg) 94%,transparent);'));
});

// beta-kr-v2 (ответ [Право] 23.10 22:40 на ✎ 17:45): строка режима «b» — без многоточия и обрезки, две ступени по ширине;
// число — из tarify.json (gost_v_den), «без входа» обязательно (у вошедшего — больше).
test('beta-kr-v2: «Без входа — N проверок в день» (≥ 360 px) и «Без входа — N в день» (< 360 px), без многоточия', () => {
  const [b, g] = sobrat('B.polosa_sobrat(True,None),B.gost_v_den()');
  assert.ok(b.includes('<span class="beta-kr-d">Без входа&nbsp;— ' + g + '&nbsp;проверок в&nbsp;день</span><span class="beta-kr-k">Без входа&nbsp;— ' + g + '&nbsp;в&nbsp;день</span>'));
  const css = chit('partials/shapka.css');
  assert.ok(!/beta-bar__kr>span\{[^}]*ellipsis/.test(css), 'многоточия нет — обрезанное «…10 провер…» читается как другое условие');
  assert.ok(css.includes('.beta-bar .beta-kr-k{display:none}') && css.includes('@media (max-width:359px){.beta-bar .beta-kr-d{display:none}.beta-bar .beta-kr-k{display:inline}}'));
  const tarify = JSON.parse(chit('tarify/tarify.json'));
  assert.ok(JSON.stringify(tarify).includes('"gost_v_den": ' + g) || JSON.stringify(tarify).includes('"gost_v_den":' + g), 'число — из tarify.json');
});
