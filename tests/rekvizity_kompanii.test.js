// rekvizity-otcheta-v1: «Реквизиты компании» в отчёте по ИНН (план 18.11, разд. 3 п. 4).
// Форма ответа — живой /api/check 18.11 01:05 (ПАО «Магнит»). node --test tests/rekvizity_kompanii.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
global.self = global.self || {};
self.DlkImya = require('../js/imya.js');
self.StatusKod = require('../js/status-kod.js');
const R = require('../js/rekvizity-kompanii.js');
const bez = (t) => String(t).replace(/ /g, ' ');

function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '2309085638', ogrn: '1032304945947', kpp: '231101001', kind: 'LEGAL', name_short: 'ПАО "МАГНИТ"',
      name_full: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО "МАГНИТ"', status: 'ACTIVE', reg_date: '2003-11-12',
      address: '350072, Краснодарский край, г Краснодар, ул Солнечная, д 15/5', okved: '68.20.21', okved_name: null,
      director_name: 'Иванов Иван Иванович' }, o.company || {}),
    checked_at: '2026-11-18T01:05:00+03:00',
    dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на 18.11.2026; задолженность — на 01.10.2026', sections: [
      { id: 'profile', rows: [['Налоговая инспекция', 'Межрайонная ИФНС № 16 по Краснодарскому краю']] },
      { id: 'management', rows: [['Генеральный директор', 'Иванов Иван Иванович'], ['Уставный капитал', '1 019 114 ₽']] },
      { id: 'activity', rows: [['Основной вид деятельности', '68.20.21 — Аренда и управление собственным или арендованным торговым объектом недвижимого имущества']] }] }
  };
}

test('все поля: наименование в ёлочках, ИНН, КПП, ОГРН, дата, статус, адрес, ОКВЭД с кодом, капитал; дата ЕГРЮЛ', () => {
  const x = R.sobrat(otvet());
  const k = x.polya.map((p) => p[2]);
  assert.deepStrictEqual(k, ['nazv', 'inn', 'kpp', 'ogrn', 'reg', 'status', 'adres', 'okved', 'kapital', 'ifns']);
  assert.strictEqual(x.polya[0][1], 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «МАГНИТ»');
  assert.match(bez(x.polya[7][1]), /^68\.20\.21 — Аренда/);
  assert.strictEqual(x.na, '18.11.2026');
  const t = R.tekst(x);
  assert.match(t, /^Полное наименование: ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «МАГНИТ»\nИНН: 2309085638\nКПП: 231101001\nОГРН: 1032304945947/);
  assert.match(t, /Источник: ЕГРЮЛ, сведения на 18\.11\.2026 \(deloskop\.ru\)$/);
});

test('без ФИО: руководителя нет ни на экране, ни в копии (рамка юриста 18.11 п. 1)', () => {
  const x = R.sobrat(otvet());
  assert.ok(!/Иванов/.test(R.html(x) + R.tekst(x)));
});

test('ИП — блока нет; нет поля — строки нет, «нет» не пишем', () => {
  assert.strictEqual(R.sobrat(otvet({ company: { inn: '770000000001', kind: 'INDIVIDUAL' } })), null);
  const r = otvet({ company: { kpp: null } });
  r.dossier.sections = [];
  const x = R.sobrat(r);
  assert.ok(!x.polya.some((p) => p[2] === 'kpp' || p[2] === 'kapital'));
  assert.ok(!/>нет</i.test(R.html(x)));
});

test('главная: модуль в пакете otchet и вызывается для чужой компании; кнопка «Скопировать реквизиты»', () => {
  const kor = path.join(__dirname, '..');
  const karta = JSON.parse(fs.readFileSync(path.join(kor, 'partials/sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.indexOf('js/rekvizity-kompanii.js') >= 0);
  const ix = fs.readFileSync(path.join(kor, 'index.html'), 'utf8');
  assert.match(ix, /if\(!svoj&&window\.DlkRekvizity\)\{try\{DlkRekvizity\.mount\(report,r\)\}/);
  assert.match(R.html(R.sobrat(otvet())), />Скопировать реквизиты</);
});
