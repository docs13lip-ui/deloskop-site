'use strict';
// yakorya-v1 ([Ночные запуски] 07.11.2026): шапка липкая (position:sticky) — переход по «#…» не должен
// прятать начало раздела под ней. Правило scroll-padding-top было только в css/ds.css, а его подключают
// не все страницы (разборы «Практики», /nalogi/…, главная — только пакет «ds»). Теперь оно при шапке:
// partials/shapka.css → css/shapka.css → пакет css/b/ds.*.css, который стоит на каждой странице с шапкой.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chit = (p) => fs.readFileSync(path.join(K, p), 'utf8');
const PRAVILO = /html\{scroll-padding-top:calc\(var\(--header-h,64px\) \+ 16px\)\}/;
const MOB = /@media \(max-width:640px\)\{html\{scroll-padding-top:calc\(var\(--header-h,56px\) \+ 16px\)\}\}/;

function stranicy(d, acc) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'partials') continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) stranicy(p, acc);
    else if (f.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

test('yakorya: правило в исходнике шапки и в собранных css/shapka.css и пакете ds', () => {
  for (const p of ['partials/shapka.css', 'css/shapka.css']) {
    const t = chit(p);
    assert.ok(PRAVILO.test(t), p + ': scroll-padding-top 64 + 16');
    assert.ok(MOB.test(t), p + ': на телефоне 56 + 16');
  }
  const ds = fs.readdirSync(path.join(K, 'css/b')).filter((f) => /^ds\.[0-9a-f]{10}\.css$/.test(f));
  assert.strictEqual(ds.length, 1, 'один пакет ds');
  const t = chit('css/b/' + ds[0]);
  assert.ok(PRAVILO.test(t) && MOB.test(t), 'пакет ds несёт правило якорей');
});

test('yakorya: значение совпадает с css/ds.css (высота шапки + 16 px)', () => {
  const ds = chit('css/ds.css');
  assert.ok(/--header-h:64px/.test(ds) && /--header-h:56px/.test(ds), 'высоты шапки 64 / 56 в токенах');
  assert.ok(/scroll-padding-top:calc\(var\(--header-h\) \+ 16px\)/.test(ds), 'ds.css: тот же отступ');
});

test('yakorya: каждая страница с шапкой получает правило — через пакет ds, css/shapka.css или css/ds.css', () => {
  const bez = [];
  for (const f of stranicy(K, [])) {
    const h = fs.readFileSync(f, 'utf8');
    if (!/<header class="shapka/.test(h)) continue;
    if (!/\/css\/b\/ds\.[0-9a-f]{10}\.css/.test(h) && !/href="\/css\/(?:ds|shapka)\.css"/.test(h)) bez.push(path.relative(K, f));
  }
  assert.deepStrictEqual(bez, [], 'страницы с шапкой без правила якорей');
});
