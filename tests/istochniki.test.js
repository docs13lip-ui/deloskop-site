// Источники — только первоисточники, без ссылок на сервисы-конкуренты (п. 47, 26.09.2026).
// Запуск: node --test tests/istochniki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const html = [];
(function obhod(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'tests' || e.name === 'сайт') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) obhod(p);
    else if (e.name.endsWith('.html')) html.push(p);
  }
})(KOREN);

const ZAPRET = /(kontur\.ru|zachestnyibiznes\.ru|rusprofile\.ru|checko\.ru|list-org\.com)/i;

test('в страницах нет ссылок на сервисы-конкуренты (ст. 5 38-ФЗ, ссылки — на первоисточник)', () => {
  assert.ok(html.length >= 25, 'страниц ' + html.length);
  for (const f of html) {
    const t = fs.readFileSync(f, 'utf8');
    const m = t.match(ZAPRET);
    assert.ok(!m, path.relative(KOREN, f) + ': ссылка на ' + (m && m[0]));
  }
});

test('1-МР Банка России: обе ветки порога и ссылка на cbr.ru', () => {
  const t = fs.readFileSync(path.join(KOREN, '115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/index.html'), 'utf8').replace(/\u00a0/g, ' ');
  assert.ok(t.includes('от 30 млн ₽ за 30 дней'));
  assert.ok(t.includes('3 предыдущих месяца'), 'ветка 1: больше обычных оборотов');
  assert.ok(t.includes('в основном безналично'), 'ветка 2: раньше работала безналично');
  assert.ok(t.includes('документы о финансовом положении'), 'исключение из 1-МР');
  for (const f of ['115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/index.html', 'nalichnye/index.html']) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    assert.ok(s.includes('https://www.cbr.ru/Crosscut/LawActs/File/12196'), f + ': нет ссылки на 1-МР на cbr.ru');
  }
});
