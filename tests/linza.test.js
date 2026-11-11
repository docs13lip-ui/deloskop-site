// linza-indeksa-v1 ([Ночные запуски] 11.11): «Линза Индекса» на карточках /company/* вместо плашки «Индекс — в полном отчёте».
// Держит: на каждой карточке без балла — кольцо без числа («1–99»), кнопка .btn--secondary с прежней целью kartochka_indeks,
// скрипт /js/linza.js; запасной кадр — CSS (без WebGL и при reduce-motion); вес скрипта ≤ 4 КБ gzip; цвета — только токены.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const kartochki = fs.readdirSync(path.join(KOREN, 'company'), { withFileTypes: true }).filter((d) => d.isDirectory())
  .map((d) => path.join('company', d.name, 'index.html')).filter((f) => fs.existsSync(path.join(KOREN, f)));

test('карточки: плашка Индекса — Линза в состоянии «ждёт», числа нет, кнопка с прежней целью', () => {
  assert.ok(kartochki.length > 100, 'карточек ' + kartochki.length);
  for (const f of kartochki) {
    const s = chitat(f);
    if (!s.includes('co-ind--wait')) continue;
    const blok = s.match(/<section class="co-ind co-ind--wait[^"]*"[\s\S]*?<\/section>/)[0];
    assert.ok(blok.includes('linza linza--zhdet'), f + ': нет Линзы');
    assert.ok(!/data-ball=/.test(blok), f + ': на карточке балла нет — числа на кольце быть не должно');
    assert.ok(blok.includes('<span class="linza__c">1–99</span>'), f);
    assert.ok(/<div class="linza__k" aria-hidden="true"><canvas class="linza__gl"><\/canvas>/.test(blok), f + ': canvas скрыт от чтения с экрана');
    assert.match(blok, /<a class="btn btn--secondary" href="\/\?inn=\d{10}" data-goal="kartochka_indeks">Посчитать Индекс на(&nbsp;| )сегодня<\/a>/, f);
    assert.strictEqual((s.match(/src="\/js\/linza\.js"/g) || []).length, 1, f + ': скрипт один раз');
    assert.strictEqual((s.match(/class="btn btn--primary"/g) || []).length <= 2, true, f + ': синяя кнопка не добавилась');
  }
});

test('js/linza.js: ≤ 4 КБ gzip, без своих цветов, reduce-motion и IntersectionObserver, DPR ≤ 2', () => {
  const js = chitat('js/linza.js');
  assert.ok(zlib.gzipSync(js, { level: 9 }).length <= 4096, 'вес');
  assert.ok(!/#[0-9a-fA-F]{6}\b|rgb\(/.test(js.replace(/\/\*[\s\S]*?\*\//g, '')), 'цвета — только токены ДС');
  for (const s of ['prefers-reduced-motion', 'IntersectionObserver', "'--line'", "'--ok'", "'--high'", "'--bad'", 'Math.min(window.devicePixelRatio || 1, 2)', "pointerType !== 'mouse'"])
    assert.ok(js.includes(s), s);
});

test('css/co.css: запасной кадр — CSS-кольцо, место под кольцо в разметке, печать без canvas', () => {
  const css = chitat('css/co.css');
  assert.ok(/\.linza__k\{[^}]*aspect-ratio:1\/1/.test(css), 'CLS 0');
  assert.ok(/\.linza__k::before\{[^}]*background:var\(--line\)/.test(css), 'запасной кадр');
  assert.ok(/\.linza__gl\{[^}]*display:none/.test(css), 'canvas скрыт до первого кадра WebGL');
  assert.ok(/@media print\{\.linza__gl\{display:none!important\}/.test(css));
});

// linza-otchet-v1 ([Ночные запуски] 11.11): стекло Линзы — в кольце «Живого Индекса» (отчёт и пример на главной), где балл посчитан.
test('linza-otchet-v1: .zhi[data-ball] — canvas поверх CSS-дуги, число и слова в разметке, CSS — запасной кадр', () => {
  const js = chitat('js/linza.js'), zh = chitat('js/zhivoj-indeks.js'), css = chitat('css/glubina.css');
  assert.ok(/z\.setAttribute\('data-ball', n\);[^\n]*\n\s*if \(W\.Linza\) W\.Linza\.zhi\(z\);/.test(zh), 'zhivoj-indeks отдаёт балл Линзе');
  assert.ok(js.includes("window.Linza = { zhi: zhi }") && js.includes("querySelectorAll('.zhi[data-ball]')"), 'кольцо примера — при загрузке, отчёта — по вызову');
  assert.ok(js.includes("cv.setAttribute('aria-hidden', 'true')"), 'canvas скрыт от чтения с экрана');
  assert.ok(js.includes("'--zona-cvet'"), 'цвет — как у слов уровня');
  assert.ok(js.includes('WEBGL_lose_context') && js.includes('el.isConnected'), 'отчёт сменился — кадры стоп, контекст отдан');
  assert.ok(/\.zhi__gl\{[^}]*display:none/.test(css), 'canvas скрыт до первого кадра');
  assert.ok(/\.zhi\.linza--gl \.zhi__duga[^{]*\{display:none\}/.test(css), 'CSS-дуга прячется только при кадре WebGL');
  assert.ok(/@media print\{\.zhi \.zhi__gl\{display:none!important\}/.test(css), 'печать — CSS-кольцо');
  const k = JSON.parse(chitat('partials/sborka.json')).pakety.glavnaya;
  assert.ok(k.indexOf('js/linza.js') === k.indexOf('js/zhivoj-indeks.js') + 1, 'в пакете главной — сразу после zhivoj-indeks');
});
