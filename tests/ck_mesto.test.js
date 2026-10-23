// ck-mesto-v1 (23.10.2026, [Ночные запуски]): окно cookies не прячет низ страницы и форму ИНН.
// Пока окно открыто — у <html> класс est-ck и --ck-h = высота окна от низа экрана; место снизу и scroll-padding —
// в partials/shapka.css (источник; css/shapka.css собирает sobrat_shapku); после выбора — класс и место уходят.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const KOD = fs.readFileSync(path.join(KOREN, 'js', 'metrika.js'), 'utf8');
const CSS = fs.readFileSync(path.join(KOREN, 'partials', 'shapka.css'), 'utf8');

function zapustit() {
  const klassy = new Set();
  const svoistva = {};
  const slushateli = {};
  let bar = null;
  const root = {
    classList: { add: (k) => klassy.add(k), remove: (k) => klassy.delete(k), contains: (k) => klassy.has(k) },
    style: { setProperty: (k, v) => { svoistva[k] = v; }, removeProperty: (k) => { delete svoistva[k]; } }
  };
  const uzel = () => ({
    parentNode: { insertBefore() {} }, setAttribute() {}, addEventListener() {}, isConnected: true,
    remove() { if (bar === this) bar = null; },
    getBoundingClientRect: () => ({ top: 739, bottom: 844, left: 0, right: 390, height: 105 })
  });
  const document = {
    readyState: 'complete', referrer: '', title: 'Проверка', documentElement: root,
    body: { appendChild(d) { if (d.className === 'ck-bar') bar = d; } },
    createElement: uzel, getElementsByTagName: () => [uzel()],
    querySelector: (s) => (s === '.ck-bar' ? bar : null), querySelectorAll: () => [],
    addEventListener: (t, f) => { slushateli[t] = f; }, removeEventListener: (t) => { delete slushateli[t]; }
  };
  const window = { document, innerHeight: 844, addEventListener() {}, removeEventListener() {} };
  const hran = {};
  const sb = {
    window, document, location: { href: 'https://deloskop.ru/', pathname: '/', search: '', origin: 'https://deloskop.ru', reload() {} },
    localStorage: { getItem: (k) => hran[k] || null, setItem: (k, v) => { hran[k] = v; } },
    JSON, Date, String, Object, URL, Math
  };
  window.localStorage = sb.localStorage; window.location = sb.location;
  vm.createContext(sb);
  vm.runInContext(KOD, sb);
  return { window, klassy, svoistva, slushateli, est: () => !!bar };
}

test('(1) окно открыто — у <html> est-ck и --ck-h = высота окна; слушаем фокус', () => {
  const s = zapustit();
  assert.ok(s.est(), 'без выбора окно показано');
  assert.ok(s.klassy.has('est-ck'));
  assert.strictEqual(s.svoistva['--ck-h'], '105px');
  assert.strictEqual(typeof s.slushateli.focusin, 'function');
});

test('(2) выбор сделан — окно, класс, место и слушатель фокуса уходят', () => {
  for (const vybor of ['prinyat', 'tolkoNuzhnye']) {
    const s = zapustit();
    s.window.dlkCookies[vybor]();
    assert.ok(!s.est());
    assert.ok(!s.klassy.has('est-ck'), vybor);
    assert.ok(!('--ck-h' in s.svoistva), vybor);
    assert.ok(!s.slushateli.focusin, vybor);
  }
});

test('(3) источник CSS: место снизу, scroll-padding только там, где окно во всю ширину; телефон — поля 8 px, кнопки 44', () => {
  assert.match(CSS, /html\.est-ck body\{padding-bottom:var\(--ck-h,0px\)\}/);
  assert.match(CSS, /@media \(max-width:1024px\)\{html\.est-ck\{scroll-padding-bottom:calc\(var\(--ck-h,0px\) \+ 12px\)\}\}/);
  assert.match(CSS, /@media print\{html\.est-ck body\{padding-bottom:0\}\}/);
  assert.match(CSS, /max-width:640px\)\{\.ck-bar \.ck-bar__in\{[^}]*padding:var\(--s-2\) var\(--gutter\) calc\(var\(--s-2\) \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(CSS, /\.ck-bar \.ck-bar__b button\{flex:1;min-height:44px/);
  const sobrano = fs.readFileSync(path.join(KOREN, 'css', 'shapka.css'), 'utf8');
  assert.ok(sobrano.includes('html.est-ck body{padding-bottom:var(--ck-h,0px)}'), 'css/shapka.css пересобран (sobrat_shapku)');
});

test('(4) текст окна не меняется (согласие — слово в слово)', () => {
  assert.ok(KOD.includes('Cookies\\u00a0— для работы сайта, Метрика\\u00a0— только с\\u00a0вашего согласия.'));
  assert.ok(KOD.includes('>Принять</button>') && KOD.includes('>Только необходимые</button>'));
});
