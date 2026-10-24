// inn-tekst-v1 (24.10.2026, [Ночные запуски]): реквизит, скопированный из договора или счёта, — «ИНН 7707083893»,
// «7707 083 893», «ИНН/КПП 7707083893/770701001», «7707083893 770701001» — на главной проверяется как ИНН.
// До правки главная отправляла в /api/check сырой текст («ИНН 7707083893» уходил поиском по названию),
// в поле «Щит» (maxlength 12) браузер обрезал «ИНН 7707083893» до «ИНН 77070838» — отказ «10 цифр» при верном ИНН,
// а «5001 0073 2259» — до 10 цифр чужого ИНН; в пустом отчёте «ИНН …» отклонялся «Здесь — только ИНН».
// Сторож: DlkInn.pohozh / izTeksta / vstavka (js/inn.js) + места подключения на главной и в отчёте.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/inn.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('реквизит из договора → чистый ИНН', () => {
  const da = {
    '7707083893': '7707083893',
    '7707 083 893': '7707083893',
    '7707-083-893': '7707083893',
    '7707 083 893 ': '7707083893',
    'ИНН 7707083893': '7707083893',
    'инн: 7707083893': '7707083893',
    'ИНН/КПП 7707083893/770701001': '7707083893',
    'ИНН 7707083893, КПП 770701001': '7707083893',
    '7707083893 770701001': '7707083893',
    'ИНН 7707083893 ОГРН 1027700132195': '7707083893',
    '5001 0073 2259': '500100732259',
    'ИНН 500100732259': '500100732259',
  };
  for (const [t, inn] of Object.entries(da)) {
    assert.ok(I.pohozh(t), t + ' — реквизит');
    assert.strictEqual(I.izTeksta(t), inn, t);
  }
});

test('название компании — не реквизит: ищем по названию, как раньше', () => {
  for (const t of ['Ромашка', 'ООО «Ромашка»', 'Ромашка 2024', 'Сбер', 'т. 900 123 45 67', 'ПАО Сбербанк ИНН 7707083893']) {
    assert.ok(!I.pohozh(t), t);
    assert.strictEqual(I.izTeksta(t), '', t);
  }
});

test('реквизит без ИНН из 10/12 цифр → пусто (отказ «10 цифр…», а не поиск по названию)', () => {
  for (const t of ['ИНН 77070838', '7707083893770701001', '2024']) {
    assert.ok(I.pohozh(t), t);
    assert.strictEqual(I.izTeksta(t), '', t);
  }
});

function pole() {
  const sl = {};
  return { value: '', sobytiya: 0, sl,
    addEventListener(n, f) { sl[n] = f; },
    dispatchEvent() { this.sobytiya++; return true; } };
}
function vstavit(p, tekst, ml) {
  let otm = false;
  p.sl.paste({ clipboardData: { getData: () => tekst }, preventDefault: () => { otm = true; } });
  if (!otm) p.value = ml ? tekst.slice(0, ml) : tekst; // так вставил бы браузер сам
  return otm;
}

test('вставка в поле: чистый ИНН без обрезки по maxlength, название — как обычно', () => {
  global.Event = class { constructor(t) { this.type = t; } };
  const glav = pole(); I.vstavka(glav);
  assert.ok(vstavit(glav, 'ИНН/КПП 7707083893/770701001')); assert.strictEqual(glav.value, '7707083893'); assert.strictEqual(glav.sobytiya, 1);
  assert.ok(!vstavit(glav, 'Ромашка')); assert.strictEqual(glav.value, 'Ромашка');
  assert.ok(!vstavit(glav, 'ИНН 77070838'), 'главная: реквизит без ИНН вставляется как есть — отказ при «Проверить»');

  const shchit = pole(); I.vstavka(shchit, true); // maxlength 12
  vstavit(shchit, 'ИНН 7707083893', 12); assert.strictEqual(shchit.value, '7707083893', 'раньше — «ИНН 77070838»');
  vstavit(shchit, '5001 0073 2259', 12); assert.strictEqual(shchit.value, '500100732259', 'раньше — «5001 0073 22» = чужой ИНН из 10 цифр');
  vstavit(shchit, '7707083893770701001', 12); assert.strictEqual(shchit.value, '7707083893770701001', 'строго: все цифры — отказ назовёт число');
  assert.ok(I.oshibka(shchit.value));
  delete global.Event;
});

test('главная: проверка, подсказки и вставка — через DlkInn', () => {
  const s = chitat('index.html');
  assert.match(s, /DlkInn\.pohozh\(v\)\)\{var ti=DlkInn\.izTeksta\(v\)/, 'submit главной чистит реквизит');
  assert.match(s, /if\(!ti\)\{note\.className='note err';note\.textContent=DlkInn\.DLINA/, 'реквизит без ИНН — отказ, а не поиск по названию');
  assert.match(s, /\|\|\(window\.DlkInn&&DlkInn\.pohozh&&DlkInn\.pohozh\(q\)\)\)\{hide\(\);return;\}/, 'реквизит не уходит в /api/suggest');
  assert.match(s, /DlkInn\.vstavka\(input\);DlkInn\.vstavka\(document\.getElementById\('myinn'\),true\)/);
  assert.match(s, /d=\(window\.DlkInn&&DlkInn\.izTeksta&&DlkInn\.izTeksta\(mi\.value\)\)\|\|/, 'Щит');
  // DlkInn — в синхронном пакете главной, до встроенного скрипта
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(sb.pakety['glavnaya-sinhr'].includes('js/inn.js'));
});

test('пустой отчёт: «ИНН 7707083893» — не «только ИНН», а сам ИНН', () => {
  const s = chitat('report.html');
  assert.match(s, /rk=window\.DlkInn&&DlkInn\.pohozh&&DlkInn\.pohozh\(i\.value\), v=\(rk&&DlkInn\.izTeksta\(i\.value\)\)\|\|/);
  assert.match(s, /if\(!rk&&\/\[A-Za-zА-Яа-яЁё\]\/\.test\(i\.value\)\)/);
  assert.match(s, /DlkInn\.vstavka\(i,true\)/);
});
