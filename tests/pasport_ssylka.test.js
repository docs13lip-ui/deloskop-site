// Паспорт по ссылке /pasport/kontragent/?inn=… (Ночные 29.09 19:07, Прорыв «Я-2») — node --test tests/pasport_ssylka.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'pasport', 'kontragent', 'index.html'), 'utf8');
const skript = html.slice(html.indexOf('var API='), html.indexOf('<!--podval-->'));
const poInn = skript.slice(skript.indexOf('function poInn('), skript.indexOf("fetch(API+'/api/report/'"));

test('параметр inn читается, ветка «по ИНН» стоит до проверки id', () => {
  assert.ok(skript.includes("inn=(q.get('inn')||'').replace(/\\D/g,'')"));
  const i = skript.indexOf('if(!id&&inn){poInn(inn);return;}');
  assert.ok(i > 0 && i < skript.indexOf('if(!id||!/^[A-Za-z0-9_-]{8,24}$/.test(id))'), 'ветка по ИНН — раньше отказа «Паспорт открывается из досье»');
});

test('проверка тратится только по нажатию: /api/check вызывается внутри обработчика кнопки', () => {
  const klik = poInn.indexOf('b.onclick=function(){');
  const zapros = poInn.indexOf("fetch(API+'/api/check?q='");
  assert.ok(klik > 0 && zapros > klik, 'запрос к /api/check — только после нажатия «Собрать Паспорт»');
  assert.strictEqual((poInn.match(/fetch\(/g) || []).length, 1, 'в ветке по ИНН ровно один запрос');
  assert.ok(poInn.includes('Это одна проверка из вашего лимита'));
});

test('ИП и неверный ИНН — без запросов, с честным текстом и ссылкой', () => {
  const ip = poInn.indexOf('if(v.length===12)');
  const zapros = poInn.indexOf("fetch(API+'/api/check");
  assert.ok(ip > 0 && ip < zapros);
  assert.ok(poInn.includes('Паспорт индивидуального предпринимателя пока не выпускаем'));
  assert.ok(poInn.includes("<a href=\"/?inn='+v+'\">"));
  assert.ok(poInn.indexOf('if(!E.innValid(v))') < ip, 'сначала контрольная цифра');
  assert.ok(poInn.includes('не сходится контрольная цифра'));
});

test('после проверки — на Паспорт по номеру досье, сумма и режим сохраняются; ошибка сервера экранируется', () => {
  assert.ok(poInn.includes("location.replace('/pasport/kontragent/?id='+encodeURIComponent(x.j.report_id)+keep)"));
  assert.ok(poInn.includes("['summa','rezhim','ref']"));
  assert.ok(poInn.includes('esc((x.j&&x.j.detail)'), 'текст ошибки сервера — через esc');
  assert.ok(poInn.includes('x.status===429'));
});

test('«Ссылка для коллеги» — по ИНН, номер досье из рук не уходит', () => {
  assert.ok(skript.includes("SAJT+'/pasport/kontragent/?inn='+m.inn"));
  assert.ok(!/var link=location\.href\.replace\([^;]*;\n/.test(skript), 'ссылка по location.href (с id досье) — только для образца');
  assert.ok(html.includes('>Ссылка для коллеги</button>'));
});

test('страница по-прежнему noindex; в тексте экрана нет обещаний', () => {
  assert.ok(/<meta name="robots" content="noindex/.test(html));
  assert.ok(!/гарант|сертифик|официальн|заверен/i.test(poInn));
});
