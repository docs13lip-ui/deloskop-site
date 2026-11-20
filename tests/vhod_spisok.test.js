'use strict';
// vhod-spisok-v1 ([Ночные запуски] 19.11.2026): на /proverka-spiska/ (проверка справочника контрагентов из 1С)
// вели только шапка и статьи. Теперь — из витрины /vse-vozmozhnosti/ (свой экспонат после «Кому вы платите»),
// с главной (вход «02 · Поставщики»), со страницы выписки (первая карточка «Дальше по Щиту») и из подвала.
// Слова экспоната — только то, что страница списка правда умеет (сверка ниже с её текстом).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
const main = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const V = JSON.parse(chitat('partials/vitrina.json'));

test('витрина: экспонат «Проверка справочника контрагентов» сразу после «Кому вы платите»', () => {
  const ids = V.eksponaty.map((x) => x.id);
  assert.strictEqual(ids[ids.indexOf('vypiska') + 1], 'spisok');
  const x = V.eksponaty.find((e) => e.id === 'spisok');
  assert.strictEqual(x.status, 'zhivoe');
  assert.strictEqual(x.ssylka, '/proverka-spiska/');
  assert.strictEqual(x.geroj, 'spisok');
  const s = chitat('vse-vozmozhnosti/index.html');
  assert.ok(s.includes('id="vg-spisok"'), 'рисунок сцены собран');
  assert.ok(/<li class="vit-e [^"]*" id="spisok"[^>]*>[\s\S]*?href="\/proverka-spiska\/"/.test(s), 'в зале ссылка на страницу');
  assert.ok(s.includes('"url": "https://deloskop.ru/vse-vozmozhnosti/#spisok"'), 'в ItemList');
});

test('витрина: слова экспоната опираются на страницу списка', () => {
  const sp = tekst(main(chitat('proverka-spiska/index.html')));
  for (const f of ['До 200 организаций за раз', 'Проблемные — первыми', 'На сервер уходят только ИНН организаций',
    'за последние 30 дней, с датой у каждой строки', '.xlsx или .csv', 'Отчёт ›']) assert.ok(sp.includes(f), 'на /proverka-spiska/ нет: ' + f);
  assert.ok(chitat('js/spisok.js').includes('csv'), 'итог файлом CSV');
  const x = JSON.stringify(V.eksponaty.find((e) => e.id === 'spisok'));
  assert.ok(!/сменил|история|все реестры|суд/i.test(x), 'не обещаем того, чего список не проверяет');
});

test('входы: главная, «Кому вы платите», подвал', () => {
  const g = main(chitat('index.html'));
  const vhod = g.slice(g.indexOf('data-vhod="entry_watch"'), g.indexOf('</article>', g.indexOf('data-vhod="entry_watch"')));
  assert.ok(/<nav class="vhod__dop"[^>]*><a href="\/proverka-spiska\/">Справочник из&nbsp;1С<\/a>/.test(vhod));
  const v = main(chitat('kontragenty-iz-vypiski/index.html'));
  const more = v.slice(v.indexOf('<section class="more">'));
  assert.ok(/^<section class="more"><h2>[^<]*<\/h2><div class="cards">\n<a class="card" href="\/proverka-spiska\/">/.test(more), 'первая карточка');
  assert.ok(chitat('tests/sobrat_shapku.py').includes('("Проверка списка", "/proverka-spiska/")'), 'подвал: «Перед оплатой»');
});
