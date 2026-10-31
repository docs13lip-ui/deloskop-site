// podval-skladnoj-v1 (31.10.2026): подвал на телефоне складывается в 4 строки, с мышью и без JS — как был.
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const KOLONKI = ['Продукты', 'Знания', 'Компания', 'Документы'];

function podvalIz(html) {
  const m = html.match(/<!--podval-->([\s\S]*?)<!--\/podval-->/);
  return m ? m[1] : '';
}

test('в разметке подвала 4 колонки — <details open> с заголовком-<summary>, ссылки на месте', () => {
  for (const f of ['index.html', 'nalogi/index.html', 'praktika/index.html', 'tarify/index.html', 'pasport/index.html']) {
    const pv = podvalIz(chitat(f));
    assert.ok(pv, f + ': нет подвала');
    const det = pv.match(/<details class="podval__det" open><summary class="podval__h">([^<]+)<\/summary><ul>/g) || [];
    assert.strictEqual(det.length, 4, f + ': колонок-<details open> ' + det.length);
    KOLONKI.forEach(k => assert.ok(pv.includes('<summary class="podval__h">' + k + '</summary>'), f + ': ' + k));
    // без JS всё открыто, ни одна ссылка не спрятана
    assert.ok(!/<details class="podval__det">/.test(pv), f + ': закрытая колонка в исходнике');
    assert.ok((pv.match(/<li><a /g) || []).length >= 30, f + ': ссылок подвала меньше 30');
  }
});

test('стили: складывание только по классу podval--skl (его ставит скрипт), страничный «+/−» у заголовков снят', () => {
  const css = chitat('css/podval.css');
  assert.match(css, /\.podval--skl \.podval__cols\{grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.podval\.podval--skl \.podval__det>\.podval__h\{[^}]*min-height:48px/);
  assert.match(css, /\.podval \.podval__det>\.podval__h::before,\.podval \.podval__det>\.podval__h::after\{content:none\}/);
  assert.match(css, /\.podval \.podval__col>\.podval__det\{display:block;margin:0;padding:0;border:0/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.podval\.podval--skl/);
  // цвета — только токены: свой HEX пересобрал бы тёмную тему всех страниц
  const blok = css.split('\n').filter(s => s.includes('podval--skl') || s.includes('podval__det')).join('\n');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(blok), 'HEX в правилах складного подвала');
});

function sreda(matches) {
  const kl = new Set();
  const slush = {};
  const dets = KOLONKI.map(() => {
    const s = { tabIndex: 0, addEventListener(t, f) { this.klik = f; } };
    return { open: true, querySelector: () => s, s };
  });
  const pv = { classList: { toggle(c, v) { v ? kl.add(c) : kl.delete(c); } }, querySelectorAll: () => dets };
  const doc = { readyState: 'complete', querySelector: q => (q === '.podval' ? pv : null), querySelectorAll: () => [], addEventListener() {} };
  const mq = { matches, addEventListener(t, f) { slush.f = f; } };
  const win = { document: doc };
  vm.runInNewContext(chitat('js/shapka.js'), { window: win, document: doc, location: { pathname: '/' }, localStorage: { getItem: () => null } });
  const api = win.dlkPodval(doc, mq);
  return { kl, dets, mq, slush, api };
}

test('скрипт: телефон — колонки закрыты и в Tab; компьютер — открыты, заголовок не жмётся и не в Tab', () => {
  const t = sreda(true);
  assert.ok(t.kl.has('podval--skl'));
  t.dets.forEach(d => { assert.strictEqual(d.open, false); assert.strictEqual(d.s.tabIndex, 0); });
  let otmenen = false;
  t.dets[0].s.klik({ preventDefault() { otmenen = true; } });
  assert.strictEqual(otmenen, false, 'на телефоне касание раскрывает колонку');

  // повернули телефон / расширили окно — колонки снова открыты
  t.mq.matches = false; t.slush.f();
  assert.ok(!t.kl.has('podval--skl'));
  t.dets.forEach(d => { assert.strictEqual(d.open, true); assert.strictEqual(d.s.tabIndex, -1); });
  t.dets[0].s.klik({ preventDefault() { otmenen = true; } });
  assert.strictEqual(otmenen, true, 'с мышью клик по заголовку колонку не закрывает');
});

test('без подвала на странице скрипт молчит', () => {
  const doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const win = { document: doc };
  vm.runInNewContext(chitat('js/shapka.js'), { window: win, document: doc, location: { pathname: '/' }, localStorage: { getItem: () => null } });
  assert.strictEqual(win.dlkPodval(doc, { matches: true }), null);
});
