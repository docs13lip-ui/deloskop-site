// zhivoj-v1: сторож живой смены темы (круг от кнопки) и отклика кнопок на нажатие.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

const JS = chitat('js/shapka.js');
const CSS_ISH = chitat('partials/shapka.css');
const CSS = chitat('css/shapka.css');

test('смена темы: View Transition с кругом от кнопки, обе кнопки (шапка и подвал) идут через неё', () => {
  assert.match(JS, /document\.startViewTransition\(delo\)/);
  assert.match(JS, /pseudoElement: "::view-transition-new\(root\)"/);
  assert.match(JS, /circle\(0px at /);
  assert.match(JS, /smena\(b, root\.dataset\.theme === "dark" \? "light" : "dark"\)/, 'кнопка в шапке');
  assert.match(JS, /smena\(b, b\.getAttribute\("data-tema-v"\)\)/, 'переключатель в подвале');
  // прямого primenit() в обработчиках клика больше нет — только через smena
  const kliki = JS.slice(JS.indexOf('// кнопка в шапке: тёмная'), JS.indexOf('if (mq) { var sl'));
  assert.ok(!/localStorage\.setItem/.test(kliki), 'выбор запоминает smena');
});

test('смена темы: «Уменьшить движение», вкладка в фоне, нет поддержки, тот же выбор — сразу, без перехода', () => {
  const f = JS.slice(JS.indexOf('var tishe = function'), JS.indexOf('// кнопка в шапке: тёмная'));
  assert.match(f, /budet === root\.dataset\.theme\) \{ primenit\(\); return; \}/);
  assert.match(f, /!document\.startViewTransition \|\| tishe\(\) \|\| document\.visibilityState === "hidden"/);
  assert.match(f, /prefers-reduced-motion: reduce/);
  assert.match(f, /vt\.finished\.then\(konec, konec\)/, 'класс tema-vt снимается и при сбое');
  // класс иконки ставится внутри обновления — в снимок старой страницы не попадает
  assert.match(f, /var delo = function \(\) \{\s*if \(!tishe\(\)\) \{ root\.classList\.add\("tema-ik"\)/);
});

test('css: на время перехода имена снимаются, корень без затухания, иконка — только compositor-свойства; есть в собранном css/shapka.css', () => {
  for (const [imya, s] of [['partials/shapka.css', CSS_ISH], ['css/shapka.css', CSS]]) {
    assert.ok(s.includes('.tema-vt body *{view-transition-name:none!important}'), imya + ': имена');
    assert.ok(s.includes('.tema-vt::view-transition-old(root),.tema-vt::view-transition-new(root){animation:none;mix-blend-mode:normal}'), imya + ': корень');
    const kf = s.match(/@keyframes dlk-ikonka\{([^}]*\}[^}]*)\}/);
    assert.ok(kf, imya + ': ключевые кадры иконки');
    const svojstva = kf[1].match(/[a-z-]+(?=:)/g);
    for (const p of svojstva) assert.ok(['rotate', 'scale', 'opacity'].includes(p), imya + ': не compositor-свойство ' + p);
    assert.ok(s.includes('@media (prefers-reduced-motion:reduce){.tema-ik .shapka .shapka__tema svg{animation:none}}'), imya + ': reduce');
  }
});

test('кнопки: вдавливание только свойством scale через Web Animations, без transform/transition, с выходом при reduce', () => {
  const i = JS.indexOf('/* §10. zhivoj-v1');
  assert.ok(i > 0, '§10 есть');
  const f = JS.slice(i);
  assert.match(f, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(f, /if \(tiho\.matches/);
  assert.match(f, /\{ scale: 0\.96 \}/);
  assert.ok(!/transform|transition/.test(f.replace(/\/\*[\s\S]*?\*\//g, '')), 'не трогает transform и transition');
  assert.match(f, /r\.width > 480 \|\| r\.height > 120/, 'крупные блоки не вдавливаем');
  assert.match(f, /\{ passive: true \}/);
});
