// navigaciya-shapka-v1 (18.11.2026, план «сайт лучше справочников», разд. 6 Н1):
// шапка из четырёх разделов с раскрывающимся списком; до любого раздела — не больше двух нажатий с любой страницы.
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const P = chitat('partials/shapka.html');
const NAV = P.slice(P.indexOf('<ul class="shapka__list">'), P.indexOf('</nav>'));

// разделы сайта из Н1 — каждый должен быть в одном из четырёх списков (нажатие 1 — раздел, 2 — ссылка)
const NUZHNO = {
  'Проверка': ['/#inn', '/proverit-schet/', '/kontragenty-iz-vypiski/', '/proverka-spiska/', '/pasport/kontragent/', '/sravnit/'],
  'Компании': ['/company/', '/company/#po-otraslyam', '/company/#po-regionam', '/reyting/'],  // kompanii-shapka-v1: отрасли и регионы — якорями каталога /company/ (постоянные), не хабами групп
  'Знания': ['/praktika/', '/nalogi/', '/115-fz/', '/zhurnal/'],
  'О сервисе': ['/indeks/', '/tochnost/', '/vse-vozmozhnosti/', '/tarify/', '/obnovleniya/'],
};

function gruppy() {
  return [...NAV.matchAll(/<li class="shapka__gr" data-gr>([\s\S]*?)<\/div>\s*<\/li>/g)].map(m => {
    const t = m[1];
    const b = t.match(/<button class="shapka__link shapka__gk" type="button" aria-expanded="false" aria-controls="([^"]+)" data-match="([^"]+)">([^<]+)</);
    return { id: b[1], match: b[2], imya: b[3].replace(/&nbsp;/g, ' '), pan: t.match(/<div class="shapka__pan" id="([^"]+)" hidden>/), hrefs: [...t.matchAll(/href="([^"]+)"/g)].map(x => x[1]) };
  });
}

test('четыре раздела, у каждого кнопка с aria-expanded и список, скрытый до нажатия', () => {
  const g = gruppy();
  assert.deepStrictEqual(g.map(x => x.imya), Object.keys(NUZHNO));
  for (const x of g) {
    assert.ok(x.pan && x.pan[1] === x.id, x.imya + ': aria-controls не совпадает с id списка');
    assert.ok(x.hrefs.length >= 2 && x.hrefs.length <= 7, x.imya + ': пунктов ' + x.hrefs.length);
    for (const h of NUZHNO[x.imya]) assert.ok(x.hrefs.includes(h), x.imya + ': нет ' + h);
  }
  assert.strictEqual(new Set(g.map(x => x.id)).size, 4);
});

test('подсветка раздела по адресу: data-match раздела ловит свои страницы и не ловит чужие', () => {
  const g = gruppy();
  for (const x of g) {
    const re = new RegExp(x.match);
    for (const h of x.hrefs) if (h !== '/#inn') assert.ok(re.test(h.split('#')[0]), x.imya + ': не подсветится на ' + h);
    for (const y of g) if (y !== x) for (const h of y.hrefs) if (h !== '/#inn') assert.ok(!re.test(h), x.imya + ' подсветится на ' + h);
  }
});

test('каждая ссылка списков ведёт на страницу из репозитория; хабов групп (/company/otrasl|region/) в шапке нет — они исчезают с числом карточек', () => {
  assert.ok(!/\/company\/(otrasl|region)\//.test(P), 'ссылка на хаб группы в шапке');
  for (const x of gruppy()) for (const h of x.hrefs) {
    const u = h.split('#')[0];
    const f = u === '/' ? 'index.html' : u.slice(1) + 'index.html';
    assert.ok(fs.existsSync(path.join(KOREN, f)), 'нет страницы ' + h);
  }
});

test('телефон: меню-лист — поиск первым, затем те же четыре группы в том же порядке', () => {
  const m = P.slice(P.indexOf('<nav class="mnav__body"'), P.indexOf('<div class="mnav__extra">'));
  assert.ok(m.indexOf('data-mnav-poisk') < m.indexOf('class="mnav__h"'), 'поиск — первым');
  const h = [...m.matchAll(/<p class="mnav__h">([^<]+)</g)].map(x => x[1].replace(/&nbsp;/g, ' '));
  assert.deepStrictEqual(h, Object.keys(NUZHNO));
});

test('поведение: раскрытие с клавиатуры, Esc возвращает фокус, мобильный лист с 1023 px, поиск из листа — та же строка', () => {
  const js = chitat('js/shapka.js');
  for (const k of ['"Escape"', '"ArrowDown"', 'focusout', 'pointerenter', 'aria-expanded', '[data-mnav-poisk]', '(min-width:1024px)'])
    assert.ok(js.includes(k), 'js/shapka.js: нет ' + k);
  const css = chitat('partials/shapka.css');
  assert.match(css, /@media \(max-width:1023px\)\{\n \.shapka \.shapka__nav/);
  assert.ok(!/@media \(max-width:860px\)/.test(css), 'прежняя граница 860 px осталась');
  // строка поиска в шапке — на широком экране, кроме главной (там своя строка #inn)
  assert.match(css, /body:has\(#inn\) \.shapka \.shapka__poisk-t/);
});

test('kompanii-shapka-v1: якорь на эту же страницу из меню телефона — после закрытия листа прокрутка к цели', () => {
  const js = chitat('js/shapka.js');
  assert.ok(/a\.pathname === location\.pathname\) yakor = document\.getElementById\(a\.hash\.slice\(1\)\)/.test(js), 'нет запоминания якоря');
  assert.ok(/if \(yakor\) \{ var t = yakor; yakor = null; t\.scrollIntoView\(\); \}/.test(js), 'нет прокрутки после закрытия');
  for (const h of ['/company/#po-otraslyam', '/company/#po-regionam']) {
    const id = h.split('#')[1];
    assert.ok(chitat('company/index.html').includes('id="' + id + '"'), 'на /company/ нет якоря ' + id);
    assert.ok(P.includes('class="mnav__link" href="' + h + '"'), 'в меню телефона нет ' + h);
  }
});
