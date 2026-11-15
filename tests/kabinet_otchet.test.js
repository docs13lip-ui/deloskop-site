// kabinet-otchet-v1 (15.11.2026): отчёт о контрагенте — шапка «как обложка дела» на экране; печать и PDF — бумага.
// (1) Обложка: кожа, латунный кант и прострочка — только в @media screen, цвета материалов — var(--mat-*,#…).
// (2) bumaga-pechat-v1: в тёмной теме отчёт уходил на печать светлыми буквами; на время печати — светлая тема.
// (3) На бумаге — корешок красного дерева слева, без фактур.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const bezMaterialov = (css) => css.replace(/var\(--mat-[\w-]+,#[0-9A-Fa-f]{3,8}\)/g, '');

test('обложка отчёта — только на экране, материалы — var(--mat-*,#…)', () => {
  const h = R('report.html');
  const m = h.match(/@media screen\{\n\.doc\{--dpad[\s\S]*?\n\}\n/);
  assert.ok(m, 'блок обложки в @media screen');
  assert.match(m[0], /\.dhead\{[^}]*faktura-kozha\.webp/, 'кожа с тиснением');
  assert.match(m[0], /repeating-linear-gradient\(90deg,var\(--mat-latun,#B58A32\) 0 7px,transparent 7px 13px\)/, 'прострочка');
  assert.match(m[0], /--mat-kozha-vual/, 'фактура приглушена — тихая');
  assert.doesNotMatch(bezMaterialov(m[0]), /#[0-9A-Fa-f]{3,8}\b|rgba?\(/, 'цвет числом вне var(--mat-*) — тёмная тема его перекрасит');
  const tema = (h.match(/<style data-tema>[\s\S]*?<\/style>/) || [''])[0];
  assert.doesNotMatch(tema, /\.dhead/, 'тёмной пары у обложки нет');
});

test('печать: бумага с корешком красного дерева, без кожи', () => {
  const h = R('report.html');
  const pech = h.match(/@media print\{\n  @page\{size:A4[\s\S]*?\n\}/);
  assert.ok(pech, 'основной блок печати');
  assert.match(pech[0], /\.doc::before\{[^}]*var\(--mat-derevo2,#86382C\)[^}]*print-color-adjust:exact/, 'корешок');
  assert.doesNotMatch(pech[0], /faktura-/, 'фактуры на бумагу не идут');
  assert.doesNotMatch(bezMaterialov(pech[0].match(/\.doc::before\{[^}]*\}/)[0]), /#[0-9A-Fa-f]{3,8}\b/);
});

test('bumaga-pechat-v1: на время печати — светлая тема, после — выбранная', () => {
  const js = R('js/shapka.js');
  assert.match(js, /addEventListener\("beforeprint", function \(\) \{ if \(root\.dataset\.theme === "dark"\) \{ root\.dataset\.pechat = "1"; root\.dataset\.theme = "light"; \} \}\)/);
  assert.match(js, /addEventListener\("afterprint", function \(\) \{ if \(root\.dataset\.pechat\) \{ delete root\.dataset\.pechat; primenit\(\); \} \}\)/);
  const dir = path.join(__dirname, '..', 'js', 'b');
  const yadro = fs.readdirSync(dir).filter((f) => /^yadro\.[0-9a-f]+\.js$/.test(f));
  assert.ok(yadro.some((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('beforeprint')), 'дошло до пакета yadro');
});
