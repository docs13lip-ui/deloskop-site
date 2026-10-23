// inn-nazvanie-v1 (24.10.2026, [Ночные запуски]): название вместе с ИНН — «ПАО Сбербанк ИНН 7707083893»,
// «ООО «Ромашка», ИНН/КПП 7707083893/770701001», «Сбербанк 7707083893» — на главной проверяется по ИНН.
// До правки: «Проверить» отправлял в /api/check весь текст, а живой /api/suggest 24.10 на «ПАО Сбербанк ИНН 7707083893»
// отвечал {"items":[]} (на «Сбербанк 7707083893» и «7707083893» — ПАО Сбербанк): слово «ИНН» ломало поиск по названию.
// В «Щите» (maxlength 12) вставка такой строки обрезалась до «ПАО Сбербанк» — отказ «10 цифр».
// Сторож: DlkInn.vNazvanii (js/inn.js) + места подключения на главной и в пустом отчёте.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/inn.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('ИНН в названии → ИНН', () => {
  const da = {
    'ПАО Сбербанк ИНН 7707083893': '7707083893',
    'ООО «Ромашка», ИНН/КПП 7707083893/770701001': '7707083893',
    'Сбербанк, инн: 7707-083-893': '7707083893',
    'Сбербанк 7707083893': '7707083893',
    'Сбербанк (7707083893)': '7707083893',
    'ИП Иванов ИНН 500100732259': '500100732259',
    'ООО Ромашка ИНН 7707083894': '7707083894', // опечатка после «ИНН» — отдаём, отказ назовёт опечатку
  };
  for (const [t, inn] of Object.entries(da)) assert.strictEqual(I.vNazvanii(t), inn, t);
  assert.ok(I.oshibka(I.vNazvanii('ООО Ромашка ИНН 7707083894')), 'опечатка → «контрольная цифра не сходится»');
});

test('без ИНН — поиск по названию, как раньше', () => {
  for (const t of ['Ромашка', 'Ромашка 2024', 'Ромашка 7707083894' /* без «ИНН» и контрольная не сходится */,
    'Ромашка т. 89001234567', 'Ромашка ИНН', 'ООО «Рога и копыта» ОГРН 1027700132195']) {
    assert.strictEqual(I.vNazvanii(t), '', t);
  }
  // чистый реквизит — забота izTeksta (inn-tekst-v1), здесь не трогаем
  for (const t of ['ИНН 7707083893', '7707 083 893', 'ИНН/КПП 7707083893/770701001']) assert.strictEqual(I.vNazvanii(t), '', t);
});

test('«Щит»: вставка названия с ИНН — сам ИНН; главная — текст как есть', () => {
  global.Event = class { constructor(t) { this.type = t; } };
  const pole = () => { const sl = {}; return { value: '', sl, addEventListener(n, f) { sl[n] = f; }, dispatchEvent() { return true; } }; };
  const vstavit = (p, t, ml) => { let o = false; p.sl.paste({ clipboardData: { getData: () => t }, preventDefault: () => { o = true; } }); if (!o) p.value = ml ? t.slice(0, ml) : t; return o; };
  const shchit = pole(); I.vstavka(shchit, true);
  vstavit(shchit, 'ПАО Сбербанк ИНН 7707083893', 12); assert.strictEqual(shchit.value, '7707083893', 'раньше — «ПАО Сбербанк»');
  const glav = pole(); I.vstavka(glav);
  assert.ok(!vstavit(glav, 'ПАО Сбербанк ИНН 7707083893')); assert.strictEqual(glav.value, 'ПАО Сбербанк ИНН 7707083893', 'главная: видно, что вставили; ИНН берём при «Проверить»');
  delete global.Event;
});

test('главная и пустой отчёт подключены', () => {
  const g = chitat('index.html');
  assert.match(g, /else if\(window\.DlkInn&&DlkInn\.vNazvanii\)\{var tn=DlkInn\.vNazvanii\(v\);if\(tn\)\{v=digits=tn;input\.value=tn;\}\}/, 'submit');
  assert.match(g, /var qn=\(window\.DlkInn&&DlkInn\.vNazvanii&&DlkInn\.vNazvanii\(q\)\)\|\|q;/, 'подсказка по ИНН из названия');
  assert.match(g, /encodeURIComponent\(qn\)/);
  assert.match(g, /DlkInn\.izTeksta\(mi\.value\)\)\|\|\(window\.DlkInn&&DlkInn\.vNazvanii&&DlkInn\.vNazvanii\(mi\.value\)\)\|\|/, 'Щит');
  const r = chitat('report.html');
  assert.match(r, /var vn=!rk&&window\.DlkInn&&DlkInn\.vNazvanii&&DlkInn\.vNazvanii\(i\.value\);if\(vn\)\{rk=true;v=vn;\}/);
});
