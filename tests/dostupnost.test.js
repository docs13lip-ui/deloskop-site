// dostupnost-v1 (25.10.2026): находки axe-core 4.10 на 28 страницах × 1280/390 px (Ночные запуски, Chromium):
// (1) ссылки в нижней строке подвала отличались от текста только цветом — 1,52 : 1 при нужных 3 : 1 (WCAG 1.4.1),
//     на каждой странице; (2) широкие таблицы .tw на 390 px листаются вбок, но без мыши до них не добраться
//     (scrollable-region-focusable: /tarify/, /indeks/, /tochnost/, /kontragenty-iz-vypiski/ и статьи с таблицами);
// (3) поле поиска на главной с aria-expanded без role="combobox" (aria-allowed-attr, critical).
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('ссылки в нижней строке подвала подчёркнуты — в исходнике, css/podval.css и пакете ds', () => {
  const PRAVILO = '.podval .podval__niz a{text-decoration:underline';
  assert.ok(chitat('tests/sobrat_shapku.py').includes(PRAVILO), 'sobrat_shapku.py');
  assert.ok(chitat('css/podval.css').includes(PRAVILO), 'css/podval.css — запустите tests/sobrat_shapku.py');
  const ds = fs.readdirSync(path.join(KOREN, 'css/b')).filter(f => /^ds\.[0-9a-f]{10}\.css$/.test(f));
  assert.strictEqual(ds.length, 1, 'пакет ds: ' + ds.join(', '));
  assert.ok(chitat('css/b/' + ds[0]).includes(PRAVILO), 'пакет ds — запустите tests/sobrat_js.py');
  // колонки подвала — списки ссылок, их не подчёркиваем (правило только для .podval__niz)
  assert.ok(/\.podval a\{[^}]*text-decoration:none/.test(chitat('css/podval.css')));
});

test('поле поиска на главной — combobox: role стоит вместе с aria-expanded', () => {
  const t = chitat('index.html');
  const i = t.indexOf("input.setAttribute('aria-expanded','false')");
  assert.ok(i > 0, 'подсказки по названию не найдены');
  const kusok = t.slice(Math.max(0, i - 300), i);
  assert.ok(kusok.includes("input.setAttribute('role','combobox')"), 'нет role="combobox" у #inn');
  assert.ok(t.includes("list.setAttribute('role','listbox')"));
});

test('кольцо фокуса у рамки широкой таблицы', () => {
  assert.ok(/\.tw\[data-tw-fokus\]:focus-visible\{outline:3px solid/.test(chitat('partials/shapka.css')));
  assert.ok(/\.tw\[data-tw-fokus\]:focus-visible\{outline:3px solid/.test(chitat('css/shapka.css')), 'css/shapka.css — запустите tests/sobrat_shapku.py');
});

// §11 js/shapka.js — отдельно от остальных частей файла, в песочнице с игрушечным DOM
function sredstvo() {
  const src = chitat('js/shapka.js');
  const i = src.indexOf('/* §11. dostupnost-v1');
  assert.ok(i > 0, '§11 не найден');
  const kod = src.slice(i);
  const sobytiya = {};
  function el(tag, opt = {}) {
    const a = {};
    return Object.assign({
      tagName: tag, textContent: opt.text || '', scrollWidth: opt.sw || 0, clientWidth: opt.cw || 0,
      previousElementSibling: opt.prev || null, _cap: opt.cap || null,
      setAttribute(k, v) { a[k] = String(v); }, getAttribute(k) { return k in a ? a[k] : null; },
      hasAttribute(k) { return k in a; }, removeAttribute(k) { delete a[k]; },
      querySelector(s) { return s === 'caption' ? this._cap : null; }, _a: a,
    });
  }
  const h2 = el('H2', { text: 'Нормы налоговой\n  нагрузки 2025' });
  const p = el('P', { text: 'абзац', prev: h2 });
  const sh = el('DIV', { sw: 720, cw: 358, prev: p });                 // шире рамки, заголовок выше через абзац
  const cap = el('DIV', { sw: 900, cw: 358, cap: el('CAPTION', { text: 'Тарифы' }) });
  const uzk = el('DIV', { sw: 358, cw: 358, prev: h2 });                // помещается — не трогаем
  const bez = el('DIV', { sw: 500, cw: 300 });                          // ни подписи, ни заголовка
  const vse = [sh, cap, uzk, bez];
  const okno = {
    addEventListener(n, f) { sobytiya[n] = f; },
  };
  const doc = { readyState: 'complete', querySelectorAll: s => (s === '.tw' ? vse : []), addEventListener() {} };
  const mod = { exports: {} };
  vm.runInNewContext(kod, { window: okno, document: doc, module: mod, setTimeout, clearTimeout });
  return { mod, sh, cap, uzk, bez, sobytiya };
}

test('широкая таблица: область с именем и фокусом, только пока шире рамки', () => {
  const { mod, sh, cap, uzk, bez, sobytiya } = sredstvo();
  assert.ok(mod.exports.tablicy, 'нет module.exports.tablicy');
  assert.deepStrictEqual([sh._a.tabindex, sh._a.role, sh._a['aria-label']], ['0', 'region', 'Таблица: Нормы налоговой нагрузки 2025']);
  assert.strictEqual(cap._a['aria-label'], 'Таблица: Тарифы', 'подпись <caption> — первой');
  assert.strictEqual(bez._a['aria-label'], 'Таблица');
  assert.deepStrictEqual(uzk._a, {}, 'узкая таблица — без остановки Tab');
  // повернули телефон — таблица поместилась: атрибуты снимаются; снова сузили — возвращаются
  sh.clientWidth = 900; mod.exports.tablicy.otmetit();
  assert.deepStrictEqual(sh._a, {});
  sh.clientWidth = 358; mod.exports.tablicy.otmetit();
  assert.strictEqual(sh._a.tabindex, '0');
  assert.ok(sobytiya.resize && sobytiya.load, 'слушает resize и load');
});

test('длинный заголовок — до 80 знаков с многоточием', () => {
  const { mod } = sredstvo();
  const dl = 'Очень длинный заголовок таблицы '.repeat(5);
  const w = { querySelector: () => null, previousElementSibling: { tagName: 'H3', textContent: dl, previousElementSibling: null } };
  const im = mod.exports.tablicy.imya(w);
  assert.ok(im.startsWith('Таблица: Очень длинный'));
  assert.strictEqual(im.length, 'Таблица: '.length + 80);
  assert.ok(im.endsWith('…'));
});
