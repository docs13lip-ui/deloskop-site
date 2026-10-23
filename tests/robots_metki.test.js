// robots-metki-v1 (23.10.2026): метки источника (utm_*, yclid, ysclid, yrclid) не плодят копий страниц в Яндексе —
// Clean-param в robots.txt (справка Вебмастера «Директива Clean-param»: параметры через «&», правило ≤ 500 знаков,
// директива межсекционная). Параметры, которые меняют страницу (inn, id, print), склеивать нельзя.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const robots = fs.readFileSync(path.join(KOREN, 'robots.txt'), 'utf8');
const pravila = [...robots.matchAll(/^Clean-param:\s*(\S+)(?:\s+(\S+))?\s*$/gm)].map(m => ({ param: m[1].split('&'), put: m[2] || '' }));
const skleeno = new Set(pravila.filter(p => p.put === '' || p.put === '/').flatMap(p => p.param));

test('robots.txt: метки источника склеиваются для всего сайта', () => {
  for (const p of ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'ysclid', 'yrclid'])
    assert.ok(skleeno.has(p), 'нет Clean-param для ' + p);
  for (const s of robots.split('\n').filter(s => s.startsWith('Clean-param:')))
    assert.ok(s.length <= 500, 'правило длиннее 500 знаков');
});

test('robots.txt: параметры, которые меняют страницу, не склеиваются', () => {
  for (const p of ['inn', 'id', 'print', 'q'])
    assert.ok(!skleeno.has(p), p + ' нельзя склеивать — от него зависит страница');
});

test('robots.txt: каждая utm-метка, которую ставят сайт и сборщики, покрыта Clean-param', () => {
  const vstrecheno = new Set();
  const obhod = d => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'company', 'fonts', 'сайт'].includes(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) obhod(p);
      else if (/\.(html|js|py)$/.test(f.name))
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/[?&](utm_[a-z]+)=/g)) vstrecheno.add(m[1]);
    }
  };
  obhod(KOREN);
  assert.ok(vstrecheno.has('utm_source'), 'обход не нашёл ни одной метки — сломан сам тест');
  for (const p of vstrecheno) assert.ok(skleeno.has(p), 'метка ' + p + ' встречается на сайте, но не склеена в robots.txt');
});
