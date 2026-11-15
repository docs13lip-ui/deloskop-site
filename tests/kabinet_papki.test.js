// kabinet-papki-v1 (15.11.2026): шаг 3 направления «кожа, красное дерево, латунь» — кабинет.
// «Слежение» и «Папка проверок» — папки с латунными уголками; пустые состояния — со знаком, тиснённым латунью.
// Цвета материалов — только var(--mat-*,#…): правило тёмной темы (tests/tema_temnaya.py) их не перекрашивает.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'cabinet.html'), 'utf8');
const bezMaterialov = (css) => css.replace(/var\(--mat-[\w-]+,#[0-9A-Fa-f]{3,8}\)/g, '');

test('папки кабинета: латунные уголки на «Слежении» и «Папке проверок», цвета — только материалы', () => {
  const m = H.match(/\.papka-k::before\{[^}]*\}/);
  assert.ok(m, 'правило уголков на месте');
  assert.strictEqual((m[0].match(/linear-gradient\(var\(--mat-latun,#B58A32\),var\(--mat-latun,#B58A32\)\)/g) || []).length, 8, 'четыре уголка по две линии');
  assert.match(m[0], /pointer-events:none/);
  assert.match(H, /\.papka-k\{position:relative;--ugol:18px\}/);
  assert.match(H, /@media \(max-width:560px\)\{\.papka-k\{--ugol:12px\}\.papka-k::before\{inset:8px\}\}/, 'на телефоне уголки меньше и не задевают заголовок');
  assert.doesNotMatch(bezMaterialov(m[0]), /#[0-9A-Fa-f]{3,8}\b|rgba?\(/, 'цвет числом вне var(--mat-*)');
  assert.match(H, /@media print\{\.papka-k::before\{display:none\}\}/, 'на печати уголков нет');
  const sek = [...H.matchAll(/<section class="card papka-k">\s*<h2>([^<]+)<\/h2>/g)].map((x) => x[1]);
  assert.deepStrictEqual(sek, ['Слежение за контрагентами', 'Папка проверок']);
  const tema = (H.match(/<style data-tema>[\s\S]*?<\/style>/) || [''])[0];
  assert.doesNotMatch(tema, /papka-k|pust__znak/, 'тёмной пары у материалов нет');
});

test('пустые состояния кабинета — со знаком (декоративным) и подсказкой', () => {
  for (const id of ['watchEmpty', 'checksEmpty']) {
    const m = H.match(new RegExp('<p class="empty pust" id="' + id + '" hidden>([\\s\\S]*?)</p>'));
    assert.ok(m, id);
    assert.match(m[1], /^<svg class="pust__znak" width="44" height="44" viewBox="0 0 120 120"[^>]*aria-hidden="true"/, id + ': знак первым и скрыт от экранных дикторов');
    assert.match(m[1], /<span class="pust__t">[^<]{20,}/, id + ': подсказка');
  }
  assert.match(H, /\.pust__znak\{[^}]*color:var\(--mat-latun-bumaga,#7A5C14\)/, 'на бумаге — тёмная латунь');
  assert.match(H, /\[data-theme=dark\] \.pust__znak\{color:var\(--mat-latun-svet,#D9B45A\)\}/);
  assert.match(H, /\$\('watchEmpty'\)\.hidden=/, 'скрипт кабинета по-прежнему управляет пустым состоянием');
});
