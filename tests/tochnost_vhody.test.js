// [Ночные запуски] 30.10 — tochnost-vhody-v1: у /tochnost/ было 3 входа из <main> (главная, /indeks/, /o-proekte/).
// Строка о точности — из абзаца методики на /indeks/ (уже опубликована); в модуле отчёта — без слова о вероятности (сторож (ж) indeks_otvet).
// Где: отчёт («Почему N» под числом Индекса, js/indeks-otvet.js) и шаг 04 «Индекс» страницы /kak-vidit-bank/.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chist = (s) => s.replace(/&nbsp;| /g, ' ');
const FRAZA = 'насколько она совпадает с реальными исходами, покажем в <a href="/tochnost/">публичном отчёте точности</a>.';

test('/indeks/: исходная фраза на месте (строки отчёта и «Как вас видит банк» повторяют её)', () => {
  assert.ok(chist(fs.readFileSync(path.join(K, 'indeks/index.html'), 'utf8')).includes('а не вероятность: ' + FRAZA));
});

test('отчёт: в «Почему N» — строка со ссылкой на /tochnost/, только при числе', () => {
  const I = require('../js/indeks-otvet.js');
  assert.strictEqual(typeof I.htmlKolonka, 'function');
  const v = { rezhim: 'chislo', ball: 72, baza: 50, vklady: [{ tekst: 'Возраст 8 лет', vklad: 6 }], plyusy: 6, plyusyUchteno: 6, plyusyMaks: 20,
    ton: 'ok', uroven: 'Без серьёзных сигналов', versiya: '1.0', istochnikov: 5, vsego: 8, polnota: 80, neUchityvali: ['суды'] };
  const h = chist(I.htmlKolonka(v));
  const det = h.slice(h.indexOf('<details'), h.indexOf('</details>'));
  assert.ok(det.includes('Индекс — оценка признаков по открытым данным. Насколько она совпадает с реальными исходами, покажем в <a href="/tochnost/">публичном отчёте точности</a>.'), 'строка внутри «Почему»');
  assert.ok(!/шанс|прогноз|гарантир/i.test(det.replace(/Не проверено[^<]*/, '')), 'без слов о вероятности исхода');
  const sokr = chist(I.htmlKolonka({ rezhim: 'sokr', polnota: 40, porog: 60, versiya: '1.0', istochnikov: 2, vsego: 8, neUchityvali: [] }));
  assert.ok(!sokr.includes('/tochnost/'), 'без числа — строки нет');
});

test('/kak-vidit-bank/: шаг 04 «Индекс» ведёт на /tochnost/', () => {
  const s = chist(fs.readFileSync(path.join(K, 'kak-vidit-bank/index.html'), 'utf8'));
  const shag = s.slice(s.indexOf('id="shag-4"'), s.indexOf('id="shag-5"'));
  assert.ok(shag.includes('Шкала — оценка признаков, не вероятность: ' + FRAZA));
});
