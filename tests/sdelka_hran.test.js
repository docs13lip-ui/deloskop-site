// sdelka-hran-v1 (п. 435 Очереди, 31.10.2026) — где хранится досье сделки, видно под заголовком, а не только в шаге 6.
// node --test tests/sdelka_hran.test.js
const test = require('node:test');
const assert = require('node:assert');
global.self = global;
global.Usloviya = require('../js/usloviya.js');
const S = require('../js/sdelka.js');

const baza = { nazvanie: 'ООО «Пример»', inn: '7707049388', svedeniyaNa: '31.10.2026', sobrano: '31.10.2026 в 23:10 МСК', it: { kod: 'predv', zagolovok: 'Досье не закрыто', tekst: '' } };
const obl = (h) => h.slice(h.indexOf('<header class="sd-cover'), h.indexOf('</header>'));

test('не сохранено — под заголовком «Не сохранено · хранится только в этом браузере», ссылка на шаг 6', () => {
  const o = obl(S.html(baza));
  assert.match(o, /<a class="noprint" href="#sd-hran" data-sd-hran>Не сохранено · хранится только в этом браузере<\/a>/);
});

test('сохранено — «Хранится в этом браузере»', () => {
  const o = obl(S.html(Object.assign({ sohraneno: { t: Date.now() } }, baza)));
  assert.match(o, /data-sd-hran>Хранится в этом браузере<\/a>/);
  assert.doesNotMatch(o, /Не сохранено/);
});

test('ссылка ведёт на существующий шаг и не попадает в PDF', () => {
  const h = S.html(baza);
  assert.match(h, /id="sd-hran"/);
  assert.match(obl(h), /class="noprint" href="#sd-hran"/);
});
