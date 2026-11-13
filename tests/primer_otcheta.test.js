// primer-otcheta-v1: «Посмотреть пример отчёта» — за флагом PRIMER_INN до ответа юриста; пример не считается проверкой человека
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const S = require('../js/schetchik.js');

test('флаг: PRIMER_INN пуст или ИНН организации (10 цифр), не ИП', () => {
  const m = /var PRIMER_INN='(\d*)';/.exec(h);
  assert.ok(m, 'нет var PRIMER_INN');
  assert.ok(m[1] === '' || /^\d{10}$/.test(m[1]), 'образец — только организация');
});

test('без флага ссылка под полем ведёт, как раньше, на /kak-rabotaet/#proverka', () => {
  assert.match(h, /<a class="primer-ssylka" href="\/kak-rabotaet\/#proverka">Посмотреть пример&nbsp;→<\/a>/);
});

test('пример подписан и не попадает в счёт проверок человека', () => {
  assert.match(h, /primer\?'Пример отчёта · сведения реестров на '/);
  assert.match(h, /if\(window\.Nedavnie&&!primer\)Nedavnie\.add/);
  assert.match(h, /if\(!svoj&&window\.Nedavnie&&Nedavnie\.dovedena&&!primer\)Nedavnie\.dovedena\(report,c\.inn\)/);
  assert.match(h, /if\(!svoj&&window\.DlkPomoglo&&!primer\)/);
  assert.match(h, /if\(window\.DlkGolos&&!primer\)/);
  assert.match(h, /if\(window\.dlkLimit&&!\(o&&o\.primer\)\)dlkLimit\.proveren/);
  assert.match(h, /o\.izIstorii\)\|\|o&&o\.primer\|\|/, 'адрес страницы при примере не меняется');
  assert.match(h, /\(o&&o\.primer\?'&primer=1':''\)/, 'сервер видит, что это пример');
});

test('событие primer_otchet — только вид', () => {
  assert.deepStrictEqual(S.teloSobytiya('primer_otchet', { host: 'deloskop.ru', pathname: '/', search: '' }), { sobytie: 'primer_otchet' });
});

// юрист 13.11 п. 1.5: образец ПАО «Магнит», полная подпись над отчётом, без ФИО и без списков дел
test('над примером — полная подпись юриста, дословно', () => {
  assert.ok(h.includes("Пример отчёта. Компания выбрана как образец: она не связана с Делоскопом и не заказывала проверку. Сведения открытых реестров на '+d.toLocaleDateString('ru-RU')+'.</p>'"));
});

test('в примере нет ФИО руководителя и списка дел', () => {
  const m = /function primerBezLyudej\(j\)\{[\s\S]*?\}catch\(e\)\{\}\}/.exec(h);
  assert.ok(m, 'нет primerBezLyudej');
  assert.match(h, /if\(o&&o\.primer\)primerBezLyudej\(x\.j\);/);
  const primerBezLyudej = new Function(m[0] + '; return primerBezLyudej;')();
  const j = { company: { kind: 'LEGAL', director_name: 'Иванов Иван Иванович', director_post: 'Генеральный директор' },
    dossier: { sections: [{ rows: [['Генеральный директор', 'Иванов Иван Иванович']], comment: 'Руководит Иванов И. И. с 2020 года' }] },
    damia: { sudy: { dannye: { vsego: 2, dela: [{ nomer: 'А40-1/2026' }] } } } };
  primerBezLyudej(j);
  const s = JSON.stringify(j);
  assert.ok(!s.includes('Иванов'), s);
  assert.strictEqual(j.company.director_name, 'указан в ЕГРЮЛ');
  assert.deepStrictEqual(j.damia.sudy.dannye.dela, []);
  assert.strictEqual(j.damia.sudy.dannye.vsego, 2);
  const org = { company: { director_name: 'ООО «УК»' } };
  primerBezLyudej(org);
  assert.strictEqual(org.company.director_name, 'ООО «УК»', 'управляющая организация — не персональные данные');
});
