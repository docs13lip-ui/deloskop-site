// golos-klienta-v1 (решение команды 12.10.2026, разд. 2 пп. 1 и 3): «Чего не хватает?» в кабинете и «Что добавить в отчёт?»
// под отчётом. Без персональных данных в тексте, только известные темы, только вошедшим, после 3-й компании, раз в 30 дней.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const G = require('../js/golos.js');
const O = require('../js/otzyv.js');

const KOREN = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const DEN = 864e5;

test('(1) чистка текста — та же, что у «Полезно?» (otzyv.js): почта, телефоны, ИНН вырезаются', () => {
  const obrazcy = [
    'пишите на ivan@mail.ru или +7 (912) 345-67-89',
    'ИП 770123456789 и ООО 7701234567 — сравнить',
    '  много    пробелов  ',
    'x'.repeat(900)
  ];
  for (const t of obrazcy) assert.strictEqual(G.chistyj(t), O.chistyj(t), t.slice(0, 40));
  const c = G.chistyj('ИНН 770123456789, почта a@b.ru, тел. 8 912 345 67 89');
  assert.ok(!/\d{10,}/.test(c) && !/@/.test(c) && !/912/.test(c), c);
});

test('(2) тело запроса: vid, ocenka golos, только известные темы по порядку списка, без почты и имени', () => {
  const b = G.telo('kabinet', ['api', 'sudy', 'sudy', 'vzlom', '<b>'], 'нужен отчёт для банка, ИНН 7701234567', 'a1b2c3d4e5f60718');
  assert.deepStrictEqual(Object.keys(b).sort(), ['id', 'ocenka', 'rezhim', 'stranica', 'tekst', 'tema', 'vid']);
  assert.strictEqual(b.id, 'a1b2c3d4e5f60718');
  assert.strictEqual(b.vid, 'kabinet');
  assert.strictEqual(b.stranica, '/cabinet.html');
  assert.strictEqual(b.ocenka, 'golos');
  assert.strictEqual(b.tema, 'sudy,api');
  assert.ok(!/\d{10}/.test(b.tekst));
  const o = G.telo('otchet', [], 'суды за пять лет');
  assert.strictEqual(o.vid, 'otchet');
  assert.strictEqual(o.tema, '');
  assert.match(o.id, /^[0-9a-f]{16}$/);
  assert.strictEqual(G.telo('kabinet', [], '   '), null, 'пустой ответ не отправляем');
  assert.strictEqual(G.telo('kabinet', ['neizvestno'], ''), null);
});

test('(3) темы — шесть, как в решении команды; подписи без восклицаний и превосходных степеней', () => {
  assert.deepStrictEqual(G.TEMY.map((x) => x.t), ['Суды и банкротства', 'Отчёт для банка', 'Выписка из 1С целиком',
    'Слежение за контрагентами', 'API и выгрузка', 'Другое']);
  const vse = G.TEMY.map((x) => x.t).concat(Object.values(G.T)).join(' ');
  assert.ok(!/!|лучш|самый|гарант|бесплатн|скидк|ИИ|нейросет/i.test(vse), vse);
});

test('(4) строка под отчётом: только вошедшим, с 3-й разной компании, потом 30 дней тишины', () => {
  let s = {};
  const t0 = Date.parse('2026-10-12T12:00:00Z');
  s = G.uchest(s, '7707083893'); assert.strictEqual(G.pokazat(s, true, t0), false);
  s = G.uchest(s, '7707083893'); assert.strictEqual(s.n, 1, 'та же компания подряд не считается');
  s = G.uchest(s, '7736207543'); assert.strictEqual(G.pokazat(s, true, t0), false);
  s = G.uchest(s, '7702070139');
  assert.strictEqual(s.n, 3);
  assert.strictEqual(G.pokazat(s, false, t0), false, 'без входа не спрашиваем');
  assert.strictEqual(G.pokazat(s, true, t0), true);
  s.t = t0;
  assert.strictEqual(G.pokazat(G.uchest(s, '7710140679'), true, t0 + 29 * DEN), false);
  assert.strictEqual(G.pokazat(G.uchest(s, '7710140679'), true, t0 + 30 * DEN), true);
});

test('(5) на устройстве нет ИНН — только короткий отпечаток', () => {
  const s = G.uchest({}, '7707083893');
  assert.ok(!JSON.stringify(s).includes('7707083893'));
  assert.ok(String(s.p).length <= 3, s.p);
});

test('(6) письмо вместо формы: тема и текст подставлены, без ИНН и почты', () => {
  const b = G.telo('kabinet', ['bank', '1s'], 'для бухгалтерии, 7701234567');
  const m = decodeURIComponent(G.mailto(b));
  assert.match(m, /^mailto:help@deloskop\.ru\?subject=Чего не хватает в Делоскопе&body=/);
  assert.match(m, /Отчёт для банка, Выписка из 1С целиком\. для бухгалтерии/);
  assert.ok(!/\d{10}/.test(m));
});

test('(7) подключение: кабинет и главная грузят golos.js и вызывают его; Метрика пропускает ключ tema', () => {
  const kab = chit('cabinet.html');
  assert.match(kab, /<section class="card" id="golos" hidden><\/section>/);
  assert.match(kab, /<script src="\/js\/golos\.js"><\/script>/);
  assert.match(kab, /DlkGolos\.kabinet\(\$\('golos'\)/);
  const gl = chit('index.html');
  assert.match(gl, /<script src="\/js\/golos\.js" defer><\/script>/);
  assert.match(gl, /DlkGolos\.posleProverki\(report,r,\{api:CAPI\}\)/);
  assert.match(chit('js/metrika.js'), /tema: 1/);
  // отправка — с cookie входа (связь с аккаунтом — только на сервере), почта и имя в тело не попадают
  const kod = chit('js/golos.js');
  assert.match(kod, /credentials: "include"/);
  assert.ok(!/email|\.name\b/.test(kod.split('var api =')[0]), 'в теле запроса нет почты и имени');
});
