// «Решение о сделке» в Паспорте контрагента (Ночные 29.09 21:05, Прорыв «Я-3») — node --test tests/pasport_reshenie.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'pasport', 'kontragent', 'index.html'), 'utf8');
const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
const blok = skript.slice(skript.indexOf('var RS={};'), skript.indexOf('function render(r,opts){'));

test('блок есть в Паспорте и стоит перед подписью ответственного', () => {
  const i = skript.indexOf('reshenieHtml(it.vyvod');
  assert.ok(i > 0, 'блок выводится');
  assert.ok(i < skript.indexOf('<div class="podpis">'), 'перед строкой подписи');
});

test('поля не уходят на сервер и в хранилища браузера', () => {
  assert.ok(blok.length > 200, 'код блока найден');
  assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon|cookie/.test(blok), 'поля остаются только на странице');
  assert.match(blok, /мы их не получаем и не храним/);
});

test('в отпечаток SHA-256 не входит — и так и написано', () => {
  assert.match(blok, /в отпечаток SHA-256 не входит/);
  const vyp = skript.indexOf('P.vypustit(p)');
  assert.ok(vyp > 0 && !/RS\b/.test(skript.slice(vyp - 400, vyp)), 'отпечаток считается из сведений, до сборки блока');
});

test('решение — за клиентом: три варианта, ничего не выбрано заранее, ФИО не спрашиваем', () => {
  assert.match(blok, /'platit','Платить'\],\['po_faktu','Платить после поставки или акта'\],\['ne_platit','Не платить'\]/);
  assert.match(blok, /RS\.resh===x\[0\]\?' checked'/, 'отмечено только то, что выбрал клиент');
  assert.ok(!/ФИО/.test(blok), 'ФИО — только от руки в строке подписи, в поля не просим');
  assert.match(blok, /решение принимает ваша компания/);
});

test('при пересчёте «на кону» введённое не теряется, сумма берётся новая', () => {
  assert.match(skript, /rsZapomnit\(\);RS\.summa='';/);
});

test('печать: подсказки в пустых полях не печатаются', () => {
  assert.match(html, /\.rs input::placeholder\{color:transparent\}/);
});
