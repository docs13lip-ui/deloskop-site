// «Три входа» на главной (Стратег 27.09 §1.2; приёмка «сайт преобразился» 13.10, строка 6).
// Запуск: node --test tests/vhody.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const glavnaya = chitat('index.html');
const blok = (glavnaya.match(/<section class="vhody"[\s\S]*?<\/section>/) || [''])[0];

test('на главной ровно три входа с целями Метрики', () => {
  assert.ok(blok, 'блока «Три входа» нет');
  const celi = [...blok.matchAll(/data-vhod="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(celi, ['entry_pay', 'entry_watch', 'entry_bank']);
  const metrika = chitat('js/metrika.js');
  for (const c of celi) assert.match(metrika, new RegExp('"' + c + '"'), `цель ${c} не описана в metrika.js`);
});

test('блок стоит сразу после первого экрана, до «Щита»', () => {
  const i = glavnaya.indexOf('class="vhody"');
  assert.ok(i > glavnaya.indexOf('class="hero"') && i < glavnaya.indexOf('id="shield"'));
});

test('каждая ссылка входа ведёт на существующую страницу', () => {
  const ssylki = [...blok.matchAll(/href="([^"#]+)/g)].map((m) => m[1]);
  assert.ok(ssylki.length >= 7);
  for (const s of ssylki) {
    const f = s.endsWith('/') ? s + 'index.html' : s;
    assert.ok(fs.existsSync(path.join(KOREN, f.replace(/^\//, ''))), `нет страницы ${s}`);
  }
});

test('у каждого входа одна главная ссылка (заголовок) — одна дверь, одна задача', () => {
  const karty = blok.split('<article').slice(1);
  assert.strictEqual(karty.length, 3);
  for (const k of karty) assert.strictEqual((k.match(/<h3><a /g) || []).length, 1);
});

test('вход «Перед оплатой» ставит курсор в поле ИНН, а скрипт подключён', () => {
  assert.match(blok, /href="\/#inn" data-vhod-inn/);
  assert.match(glavnaya, /<script src="\/js\/vhody\.js" defer><\/script>/);
  const js = chitat('js/vhody.js');
  assert.match(js, /getElementById\("inn"\)/);
  assert.match(js, /dlkGoal/);
  assert.doesNotMatch(js, /innerHTML/);
});

test('тексты входов — без обещаний и с неразрывными пробелами', () => {
  const tekst = blok.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(tekst, /гарант|безопасн|100\s*%|не заблокируют|точно/i);
  assert.doesNotMatch(tekst, /"[А-Яа-яЁё]/, 'прямые кавычки вместо ёлочек');
  assert.doesNotMatch(tekst, / - /, 'дефис вместо тире');
  assert.match(blok, /115-ФЗ/);
});
