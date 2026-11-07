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

test('5-МР Банка России вместо 1-МР: порога нет, ссылка на 5-МР, 1-МР — только как заменённые', () => {
  // 26.10.2026 Банк России выпустил 5-МР; 1-МР от 20.05.2026 утратили силу (◐ pravo.ru/news/266503, nalog-nalog.ru 27.10; cbr.ru из облака 403)
  const STR = '115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/index.html';
  const t = fs.readFileSync(path.join(KOREN, STR), 'utf8').replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|\u2011/g, '-'); // типографика — пробелы не в счёт
  assert.ok(!t.includes('от 30 млн ₽ за 30 дней'), 'порог 30 млн ₽ за 30 дней из 1-МР');
  assert.ok(!/только для физлиц/.test(t), 'фраза «оговорка только для физлиц» — в 5-МР исключение есть и для компаний');
  assert.ok(t.includes('рекомендации № 5-МР'), 'нет абзаца о 5-МР');
  assert.ok(t.includes('при любой сумме'), 'нет «порога больше нет»');
  assert.ok(t.includes('На снятие порог 1 млн ₽'), 'не сказано, что порог на снятие по 115-ФЗ в силе');
  for (const m of t.matchAll(/1-МР/g)) {
    const okno = t.slice(Math.max(0, m.index - 80), m.index + 20);
    assert.ok(/заменили/.test(okno), STR + ': 1-МР упомянуты не как заменённые');
  }
  for (const f of [STR, 'nalichnye/index.html']) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    assert.ok(!s.includes('LawActs/File/12196'), f + ': ссылка на 1-МР');
    assert.ok(s.includes('https://www.cbr.ru/Crosscut/LawActs/File/12266'), f + ': нет ссылки на 5-МР');
    assert.ok(/26\.10\.2026(&nbsp;|\s|\u00a0)+№(&nbsp;|\s|\u00a0)+5-МР/.test(s), f + ': источник 5-МР без даты и номера');
  }
});

test('«Снятие наличных»: НДФЛ — по первоисточнику (ст. 224 НК), без ссылки на страницу банка (п. 72 в, юрист 115-ФЗ)', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', '115-fz/snyatie-nalichnyh-s-raschetnogo-scheta/index.html'), 'utf8');
  assert.ok(!/sberbank\.ru/.test(t), 'ссылка на sberbank.ru');
  assert.ok(t.includes('cons_doc_LAW_28165') && t.includes('статья 224'));
});
