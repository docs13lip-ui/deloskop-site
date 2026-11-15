// kabinet-podval-v1 (15.11.2026): материалы «кабинета» (решение владельца 15.11 — кожа, красное дерево, латунь).
// Рейка красного дерева — под первым экраном главной и над подвалом всех страниц; цвета материалов — запасными
// значениями var(--mat-*,#…), чтобы правило тёмной темы (tests/tema_temnaya.py) их не перекрашивало: раньше в тёмной
// теме блик рейки становился белёсым (rgba(0,0,0,.34) → rgba(255,255,255,.496)), а латунная кромка — бурой.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const bezMaterialov = (css) => css.replace(/var\(--mat-[\w-]+,#[0-9A-Fa-f]{3,8}\)/g, '');

test('рейка под первым экраном главной: цвета материалов — только var(--mat-*,#…), тёмной пары нет', () => {
  const h = R('index.html');
  const m = h.match(/html:not\(\.rezhim-otcheta\) \.hero::after\{[^}]*\}/);
  assert.ok(m, 'правило рейки на месте');
  assert.doesNotMatch(bezMaterialov(m[0]), /#[0-9A-Fa-f]{3,8}\b|rgba?\(/, 'цвет числом вне var(--mat-*) — тёмная тема его перекрасит');
  const tema = (h.match(/<style data-tema>[\s\S]*?<\/style>/) || [''])[0];
  assert.doesNotMatch(tema, /\.hero::after/, 'в <style data-tema> не должно быть тёмной пары рейки');
});

test('подвал всех страниц: верхняя кромка — рейка красного дерева с латунью и прострочкой', () => {
  const css = R('css/podval.css');
  const m = css.match(/html:not\(\.rezhim-otcheta\) \.podval::before\{[^}]*\}/);
  assert.ok(m, 'рейка подвала в css/podval.css (источник — tests/sobrat_shapku.py)');
  assert.match(m[0], /faktura-derevo\.webp/);
  assert.match(m[0], /var\(--mat-latun,#B58A32\)/);
  assert.match(m[0], /repeating-linear-gradient\(90deg,var\(--mat-latun,#B58A32\) 0 7px,transparent 7px 13px\)/, 'прострочка');
  assert.match(m[0], /pointer-events:none/);
  assert.doesNotMatch(bezMaterialov(m[0]), /#[0-9A-Fa-f]{3,8}\b|rgba?\(/, 'цвет числом вне var(--mat-*)');
  assert.match(css, /\.podval\{position:relative;border-top:0\}/);
  assert.match(css, /html\.rezhim-otcheta \.podval\{border-top:1px solid var\(--line\)\}/, 'в режиме отчёта — прежняя тонкая линия');
  assert.doesNotMatch(R('css/tema.css'), /podval::before/, 'тёмная тема рейку подвала не перекрашивает');
  const src = R('tests/sobrat_shapku.py');
  assert.ok(src.includes('kabinet-podval-v1'), 'источник — сборщик подвала');
});

test('рейка подвала доходит до собранного пакета ds', () => {
  const dir = path.join(__dirname, '..', 'css', 'b');
  const ds = fs.readdirSync(dir).filter((f) => /^ds\.[0-9a-f]+\.css$/.test(f));
  assert.ok(ds.length >= 1);
  assert.ok(ds.some((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('.podval::before')), 'в css/b/ds.*.css есть рейка');
});
