// kuchnee-glavnaya-v1 (16.11.2026): главная на компьютере кучнее и информативнее — на первом экране 1920×1080
// без прокрутки строка проверки, пример ответа и «Что умеет Делоскоп»; отступы между блоками — меньше на треть.
// Запуск: node --test tests/kuchnee_glavnaya.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const G = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const CSS = (() => {
  const a = G.indexOf('/* kuchnee-glavnaya-v1'); assert.ok(a > 0, 'нет блока kuchnee-glavnaya-v1');
  return G.slice(a, G.indexOf('</style>', a));
})();
const blokMedia = (uslovie) => {
  const a = CSS.indexOf('@media (' + uslovie + ')'); if (a < 0) return '';
  let g = 0;
  for (let i = CSS.indexOf('{', a); i < CSS.length; i++) {
    if (CSS[i] === '{') g++;
    if (CSS[i] === '}' && --g === 0) return CSS.slice(a, i + 1);
  }
  return '';
};
const HERO = G.slice(G.indexOf('<section class="hero">'), G.indexOf('<section class="vhody"'));

test('«Что умеет» и «Чего здесь не хватает?» — внутри первого экрана, после строки и примера ответа', () => {
  const i = (s) => HERO.indexOf(s);
  for (const s of ['<form class="check"', 'class="report ex"', 'id="uslugi"', 'id="uvForm"']) assert.ok(i(s) > 0, 'в первом экране нет ' + s);
  assert.ok(i('<form class="check"') < i('class="report ex"') && i('class="report ex"') < i('id="uslugi"') && i('id="uslugi"') < i('id="uvForm"'), 'порядок: строка → пример → услуги → вопрос');
  const usl = HERO.slice(i('id="uslugi"'), HERO.indexOf('</section>', i('id="uslugi"')));
  assert.ok(!/class="wrap"/.test(usl), 'внутри первого экрана у раздела нет второй обёртки .wrap (двойные поля)');
  assert.strictEqual((usl.match(/data-usluga="[a-z]+"><svg/g) || []).length, 6, 'шесть плиток на месте');
});

test('в режиме отчёта услуги и вопрос скрыты — как все блоки главной вне первого экрана', () => {
  assert.match(CSS, /\.rezhim-otcheta \.hero \.uslugi,\.rezhim-otcheta \.hero \.uv\{display:none\}/);
});

test('компьютер (от 1200 px): две колонки — слева строка и плитки, справа пример и вопрос; отступы меньше', () => {
  const m = blokMedia('min-width:1200px');
  assert.ok(m.length > 500, 'нет блока @media (min-width:1200px)');
  assert.match(m, /\.hero \.wrap\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  assert.match(m, /\.hero-text\{grid-column:1;grid-row:1;/);
  assert.match(m, /\.hero \.uslugi\{grid-column:1;grid-row:2\/span 3;/);
  assert.match(m, /\.hero \.report\.ex\{grid-column:2;/);
  assert.match(m, /\.hero \.uv\{grid-column:2;/);
  assert.match(m, /--sect:clamp\(52px,5vw,76px\)/, 'отступ между блоками до 76 px вместо 112 — на треть меньше');
  // каждое правило блока — только вне режима отчёта: отчёт на компьютере устроен по-своему (css/otchet.css)
  const pravila = m.slice(m.indexOf('{') + 1, -1).split('}').map((x) => x.trim()).filter((x) => x && !x.startsWith('/*'));
  for (const r of pravila) assert.ok(/^(\/\*[\s\S]*?\*\/\s*)?html:not\(\.rezhim-otcheta\)/.test(r), 'правило не ограничено главной: ' + r.slice(0, 80));
});

test('телефон и планшет не задеты: всё новое для ширины — только внутри @media (min-width:1200px)', () => {
  const vne = CSS.replace(blokMedia('min-width:1200px'), '');
  for (const s of ['grid-template-columns', 'grid-column', '--sect', 'font-size', 'padding-block']) assert.ok(!vne.includes(s), s + ' — вне блока компьютера');
});

test('текст не теряется: «что получите» у плиток остаётся в разметке и для читалки; «В отчёте ещё…» виден', () => {
  const m = blokMedia('min-width:1200px');
  assert.match(m, /\.hero \.umeet span\{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset\(50%\)/, 'описание плитки — визуально скрыто, как на телефоне, не display:none');
  assert.ok(!/\.umeet span\{display:none/.test(CSS));
  assert.ok(!/\.ex-pod\{display:none/.test(m), '«В отчёте ещё…» на компьютере остаётся');
});
