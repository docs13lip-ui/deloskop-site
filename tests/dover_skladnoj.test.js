'use strict';
// dover-skladnoj-v1 ([Ночные запуски] 31.10.2026): «Откуда данные» на главной на телефоне — строка состояния
// и все 8 источников по касанию (390 px: 1 750 → ~300 px). Сторож: счёт в строке = data/istochniki.json,
// без JS блок открыт, таблица по-прежнему внутри маркеров (glavnaya_a.test.js), скрипт в пакете главной.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const R = JSON.parse(fs.readFileSync(path.join(K, 'data/istochniki.json'), 'utf8'));
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();

test('dover-skladnoj: строка состояния считает источники по реестру', () => {
  const m = /<details class="ist-det" data-skl open><summary class="ist-sv">([\s\S]*?)<\/summary>/.exec(G);
  assert.ok(m, 'блок <details data-skl open> со строкой состояния');
  const L = R.istochniki.filter((x) => x.id !== 'zsk_cbr');
  const n = (s) => L.filter((x) => x.sostoyanie === s).length;
  const t = tekst(m[1]);
  const ok = n('podklyuchen'), zam = n('zamorozhen'), net = L.length - ok - zam;
  const sl = (k, a, b) => (k === 1 ? a : b);
  assert.ok(t.includes(ok + ' ' + sl(ok, 'работает', 'работают')), 'работают: ' + t);
  if (zam) assert.ok(t.includes(zam + ' ' + sl(zam, 'не обновляется', 'не обновляются')), 'не обновляются: ' + t);
  if (net) assert.ok(t.includes(net + ' ' + sl(net, 'не подключён', 'не подключены')), 'не подключены: ' + t);
  assert.ok(t.includes('Все ' + L.length + ' источников'), 'всего: ' + t);
});

test('dover-skladnoj: таблица реестра внутри блока, «не проверено ≠ не найдено» и ЗСК — снаружи, на виду', () => {
  const i = G.indexOf('<details class="ist-det"'), j = G.indexOf('</details>', i);
  const blok = G.slice(i, j);
  assert.ok(blok.includes('<!--istochniki-glavnaya-->') && blok.includes('<!--/istochniki-glavnaya-->'));
  const posle = G.slice(j, G.indexOf('</section>', j));
  assert.match(posle, /data-ne-proveryaem/);
  assert.match(posle, /class="ist-zsk"/);
});

test('dover-skladnoj: шире 640 px строка скрыта, скрипт — в пакете главной', () => {
  assert.match(G, /\.ist-det>summary\{display:none\}/);
  assert.match(G, /@media \(max-width:640px\)\{\n  \.ist-det\{/);
  const S = JSON.parse(fs.readFileSync(path.join(K, 'partials/sborka.json'), 'utf8'));
  assert.ok(S.pakety.glavnaya.includes('js/skladnoj.js'));
  const js = fs.readFileSync(path.join(K, 'js/skladnoj.js'), 'utf8');
  assert.match(js, /max-width:640px/);
  assert.match(js, /details\[data-skl\]/);
});
