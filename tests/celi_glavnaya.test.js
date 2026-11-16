// proba-celi (16.11.2026): нажатия плиток «Что умеет Делоскоп» и кнопки «Проверить компанию» в «Условиях» главной
// считаются целями Метрики — тем же window.dlkGoal, что и остальные цели сайта: без согласия ничего не уходит,
// новых внешних адресов нет, в параметрах — только метка плитки и путь.
// Запуск: node --test tests/celi_glavnaya.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
const METRIKA = fs.readFileSync(path.join(KOREN, 'js', 'metrika.js'), 'utf8');
const sekciya = (id) => { const a = G.indexOf('id="' + id + '"'); return G.slice(a, G.indexOf('</section>', a)); };
const blok = () => {
  const a = G.indexOf('// proba-celi:'), b = G.indexOf('// /proba-celi');
  assert.ok(a > 0 && b > a, 'блок proba-celi в сценарии главной');
  return G.slice(a, b);
};
// ссылки раздела с признаком: [{href, usluga}]
const ssylki = (id, priznak) => (sekciya(id).match(/<a\b[^>]*>/g) || [])
  .filter((t) => new RegExp('\\s' + priznak + '(=|[\\s>])').test(t))
  .map((t) => ({ href: /href="([^"]*)"/.exec(t)[1], usluga: (/data-usluga="([^"]*)"/.exec(t) || [])[1] }));

// Запускает блок главной: возвращает слушатель клика и записанные вызовы dlkGoal
function zapustit(dlkGoal, href) {
  const slushateli = [];
  const vyzovy = [];
  const window = {};
  window.dlkGoal = dlkGoal === undefined ? function (cel, p) { vyzovy.push([cel, JSON.parse(JSON.stringify(p || {}))]); } : dlkGoal;
  const document = { addEventListener(tip, f, zahvat) { slushateli.push({ tip, f, zahvat }); } };
  const sb = { window, document, location: { href: href || 'https://deloskop.ru/' } };
  if (window.dlkGoal) sb.dlkGoal = window.dlkGoal;
  vm.createContext(sb);
  vm.runInContext(blok(), sb);
  return { slushateli, vyzovy };
}
// Нажатие: closest отвечает только на тот селектор, под которым лежит элемент
const nazhat = (z, selektor, a) => z.slushateli.forEach((s) => s.f({
  target: { closest: (sel) => (sel === selektor ? { getAttribute: (k) => (k === 'href' ? a.href : k === 'data-usluga' ? a.usluga : null) } : null) }
}));
const PLITKA = '#uslugi a[data-usluga]';
const KNOPKA = '#price a[data-ceny-go]';

test('плитки услуг: каждое нажатие — цель uslugi_plitka с меткой плитки и путём', () => {
  const plitki = ssylki('uslugi', 'data-usluga');
  assert.strictEqual(plitki.length, 7, 'шесть плиток и ссылка на полный каталог');
  assert.strictEqual(new Set(plitki.map((p) => p.usluga)).size, 7, 'метки плиток разные');
  const z = zapustit();
  assert.strictEqual(z.slushateli.length, 1, 'один слушатель на документ');
  assert.strictEqual(z.slushateli[0].tip, 'click');
  assert.strictEqual(z.slushateli[0].zahvat, true, 'на захвате — до перехода по ссылке');
  for (const p of plitki) nazhat(z, PLITKA, p);
  assert.deepStrictEqual(z.vyzovy, plitki.map((p) => ['uslugi_plitka', { produkt: p.usluga, kuda: p.href, mesto: 'glavnaya' }]));
});

test('кнопка «Проверить компанию» в «Условиях»: цель usloviya_proverit; нажатие мимо — без цели', () => {
  const knopki = ssylki('price', 'data-ceny-go');
  assert.strictEqual(knopki.length, 1);
  const z = zapustit();
  nazhat(z, KNOPKA, knopki[0]);
  assert.deepStrictEqual(z.vyzovy, [['usloviya_proverit', { mesto: 'glavnaya' }]]);
  nazhat(z, '.hero a', { href: '/' });
  z.slushateli.forEach((s) => s.f({ target: null }));
  z.slushateli.forEach((s) => s.f({ target: {} }));
  assert.strictEqual(z.vyzovy.length, 1, 'чужие нажатия целью не считаются');
});

test('после проверки ИП (12 или 15 цифр в адресе) цели с этой страницы не уходят; ИНН организации не мешает', () => {
  const p = ssylki('uslugi', 'data-usluga')[0];
  for (const h of ['https://deloskop.ru/?inn=' + '5'.repeat(12), 'https://deloskop.ru/otchet/' + '5'.repeat(12) + '/', 'https://deloskop.ru/?q=' + '3'.repeat(15)]) {
    const z = zapustit(undefined, h);
    nazhat(z, PLITKA, p); nazhat(z, KNOPKA, { href: '/#inn' });
    assert.strictEqual(z.vyzovy.length, 0, h);
  }
  const z = zapustit(undefined, 'https://deloskop.ru/?inn=' + '7'.repeat(10));
  nazhat(z, PLITKA, p); nazhat(z, KNOPKA, { href: '/#inn' });
  assert.strictEqual(z.vyzovy.length, 2);
});

test('без счётчика и при его ошибке переход не ломается', () => {
  const p = ssylki('uslugi', 'data-usluga')[0];
  const bez = zapustit(null);
  assert.doesNotThrow(() => nazhat(bez, PLITKA, p));
  const oshibka = zapustit(function () { throw new Error('счётчик упал'); });
  assert.doesNotThrow(() => nazhat(oshibka, PLITKA, p));
  assert.doesNotThrow(() => nazhat(oshibka, KNOPKA, { href: '/#inn' }));
});

test('параметры проходят белый список js/metrika.js без потерь; без согласия цель не уходит', () => {
  function metrika(soglasie) {
    const vyzovy = [];
    const hran = soglasie ? { dlk_cookies: JSON.stringify({ v: soglasie, t: Date.now() }) } : {};
    const uzel = () => ({ parentNode: { insertBefore() {} }, setAttribute() {}, addEventListener() {}, remove() {} });
    const document = { readyState: 'complete', referrer: '', title: 'т', body: { appendChild() {} }, createElement: uzel,
      getElementsByTagName: () => [uzel()], querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
    const window = { document };
    const sb = { window, document, location: { href: 'https://deloskop.ru/', pathname: '/', search: '', origin: 'https://deloskop.ru' },
      localStorage: { getItem: (k) => hran[k] || null, setItem() {} }, JSON, Date, String, Object, URL };
    window.localStorage = sb.localStorage; window.location = sb.location;
    vm.createContext(sb); vm.runInContext(METRIKA, sb);
    if (typeof window.ym === 'function') window.ym = function () { vyzovy.push(JSON.parse(JSON.stringify(Array.from(arguments)))); };
    return { window, vyzovy };
  }
  const plitki = ssylki('uslugi', 'data-usluga');
  const da = metrika('all');
  const z = zapustit(da.window.dlkGoal);
  for (const p of plitki) nazhat(z, PLITKA, p);
  nazhat(z, KNOPKA, { href: '/#inn' });
  const celi = da.vyzovy.filter((v) => v[1] === 'reachGoal');
  assert.strictEqual(celi.length, 8);
  assert.deepStrictEqual(celi[0].slice(2), ['uslugi_plitka', { produkt: plitki[0].usluga, kuda: plitki[0].href, mesto: 'glavnaya' }]);
  assert.deepStrictEqual(celi[7].slice(2), ['usloviya_proverit', { mesto: 'glavnaya' }]);
  for (const s of [null, 'need']) {
    const net = metrika(s);
    const zn = zapustit(net.window.dlkGoal);
    nazhat(zn, PLITKA, plitki[0]);
    nazhat(zn, KNOPKA, { href: '/#inn' });
    assert.strictEqual(net.vyzovy.length, 0, 'согласие: ' + s);
  }
});

test('тот же механизм: в блоке нет своих обращений к счётчику и новых адресов', () => {
  const b = blok();
  assert.ok(!/\bym\s*\(|reachGoal|https?:|\/\/[a-z0-9-]+\.[a-z]|fetch|sendBeacon|XMLHttpRequest|new Image|import\(/i.test(b.replace(/^\s*\/\/.*$/gm, '')), 'только dlkGoal');
  assert.ok(!/value|textContent|innerText/.test(b), 'из полей ввода ничего не берём');
  assert.strictEqual((b.match(/location/g) || []).length, 1, 'адрес страницы — только в проверке на ИНН ИП');
  assert.ok(!/\{[^{}]*location[^{}]*\}/.test(b.replace(/^\s*\/\/.*$/gm, '').replace(/\{12\}|\{15\}/g, '')), 'адрес страницы в параметры не идёт');
  const adresa = (s) => new Set((s.match(/https?:\/\/[a-z0-9.-]+/gi) || []).map((x) => x.toLowerCase()));
  assert.ok(adresa(METRIKA).size === 1 && adresa(METRIKA).has('https://mc.yandex.ru'), 'у счётчика один внешний адрес');
  assert.strictEqual((G.match(/dlkGoal\('uslugi_plitka'/g) || []).length, 1);
  assert.strictEqual((G.match(/dlkGoal\('usloviya_proverit'/g) || []).length, 1);
});
