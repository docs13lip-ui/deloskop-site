// sostoyaniya-latun-v1 (15.11.2026): шаг 5 направления «кожа, красное дерево, латунь» — состояния в латуни.
// Фокус — одна латунная рамка на весь сайт (css/detali.css, пакет «ds» на всех страницах); ожидание отчёта — блик и бегущий свет латунью.
// Цвета — только var(--mat-*,#…): правило тёмной темы (tests/tema_temnaya.py) их не перекрашивает.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(kor, f), 'utf8');
const L = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const kontrast = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('фокус — латунью в обеих темах, виден и на бумаге, и на синем (≥ 3 : 1, WCAG 1.4.11)', () => {
  const D = chitat('css/detali.css');
  const svet = D.match(/:root:not\(\[data-theme=dark\]\) :focus-visible\{outline-color:var\(--mat-fokus,(#[0-9A-F]{6})\)!important\}/);
  const tem = D.match(/\[data-theme=dark\] :focus-visible\{outline-color:var\(--mat-fokus-t,(#[0-9A-F]{6})\)!important\}/);
  assert.ok(svet && tem, 'обе рамки на месте');
  for (const fon of ['#FFFFFF', '#FFFDF6', '#F5F1E6', '#EDE8DA', '#ECEFF6', '#0D2247', '#12305F']) {
    assert.ok(kontrast(svet[1], fon) >= 3, 'светлая: ' + svet[1] + ' на ' + fon + ' = ' + kontrast(svet[1], fon).toFixed(2));
  }
  for (const fon of ['#0A1733', '#102248', '#183060', '#16357A', '#0D1D3F']) {
    assert.ok(kontrast(tem[1], fon) >= 3, 'тёмная: ' + tem[1] + ' на ' + fon);
  }
  const blok = D.slice(D.indexOf('sostoyaniya-latun-v1'));
  assert.doesNotMatch(blok, /focus-visible\{outline:/, 'меняется только цвет — толщину и outline:none страниц не трогаем');
});

test('пакет «ds» на страницах несёт латунный фокус', () => {
  const html = chitat('index.html');
  const m = html.match(/href="\/(css\/b\/ds\.[0-9a-f]+\.css)"/);
  assert.ok(m, 'пакет ds подключён');
  assert.match(chitat(m[1]), /--mat-fokus,#A07A28/, 'запустите tests/sobrat_js.py');
});

test('ожидание отчёта — в латуни, тёмной пары у материалов нет', () => {
  const O = chitat('css/otchet.css');
  assert.match(O, /\.report\.loading\{position:relative;--zh-pereliv:var\(--mat-pereliv,#E3C77838\)\}/);
  assert.match(O, /\[data-theme=dark\] \.report\.loading::after\{--zh-pereliv:var\(--mat-pereliv-t,#D9B45A1F\)\}/);
  assert.match(O, /\.zh-ist__i::after\{color:var\(--mat-zhdu,#7A5C14\)\}/);
  assert.match(O, /\[data-theme=dark\] \.zh-ist__i::after\{color:var\(--mat-zhdu-t,#D9B45A\)\}/);
  assert.match(O, /prefers-reduced-motion:reduce\)\{\.zh-ist__i::after,\.report\.loading::after\{animation:none;opacity:0\}/, '«Уменьшить движение» — ничего не движется');
  const avto = (chitat('css/tema.css').match(/\/\*<avto>\*\/[\s\S]*?\/\*<\/avto>\*\//) || [''])[0];
  assert.doesNotMatch(avto, /mat-fokus|mat-pereliv|mat-zhdu/, 'материалы не перекрашиваются');
});
