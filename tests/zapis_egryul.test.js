// [Ночные-3] zapis-egryul-v1: «Что изменилось» знает дату последнего изменения записи в ЕГРЮЛ
// (company.state_actuality_date, запасной путь — dossier.data_dates). (1) Первая проверка — «Последнее изменение записи
// в ЕГРЮЛ — ДД.ММ.ГГГГ, N … назад»; за 30 дней и меньше — отдельный блок со ссылкой на выписку. (2) Повторная — если запись
// обновилась, а сравниваемые поля прежние, одна справочная строка. node --test tests/zapis_egryul.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/dinamika.js');
const NB = ' ';

function otvet(den, zapis, extra) {
  const r = {
    company: { inn: '6164266561', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2007-06-28', invalid: false, address_invalid: false,
      name_short: 'ПАО «Пример»', director_since: '2025-01-14', kpp: '616401001', okved: '35.12', state_actuality_date: zapis },
    risk_level: 'low', checked_at: den,
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' }],
    dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на ' + den.split('-').reverse().join('.') + '; последнее изменение записи ЕГРЮЛ/ЕГРИП — 29.07.2026; задолженность — на 01.09.2026' },
  };
  return Object.assign(r, extra || {});
}
function ls() { return { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = String(v); } }; }
const bezTegov = (h) => h.replace(/<[^>]+>/g, '').split(NB).join(' ');

test('снимок хранит дату записи ЕГРЮЛ; запасной путь — data_dates; дата позже проверки — не значение', () => {
  assert.strictEqual(D.snimok(otvet('2026-10-11', '2026-07-29')).egrd, '2026-07-29');
  assert.strictEqual(D.snimok(otvet('2026-10-11', null)).egrd, '2026-07-29', 'из data_dates');
  const bez = otvet('2026-10-11', null); bez.dossier.data_dates = 'ЕГРЮЛ/ЕГРИП — на 11.10.2026';
  assert.strictEqual(D.snimok(bez).egrd, undefined);
  assert.strictEqual(D.snimok(otvet('2026-10-11', '2026-10-12')).egrd, undefined, 'будущая дата');
  const ip = otvet('2026-10-11', '2026-07-29'); ip.company.inn = '616400000017';
  assert.strictEqual(D.snimok(ip).egrd, undefined, 'у ИП не храним');
});

test('первая проверка: давняя запись — одна серая строка с датой и давностью', () => {
  const h = D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2026-07-29'), ls()));
  const t = bezTegov(h);
  assert.match(t, /Последнее изменение записи в ЕГРЮЛ — 29\.07\.2026, 2 месяца назад\. Запомнили эту проверку/);
  assert.ok(h.startsWith('<p class="izm izm--0"'), 'серая строка, в печать не идёт');
  assert.ok(!/izm--svezh/.test(h));
});

test('первая проверка: запись менялась за 30 дней — блок с выпиской ЕГРЮЛ', () => {
  const h = D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2026-09-29'), ls()));
  const t = bezTegov(h);
  assert.match(t, /Запись в ЕГРЮЛ менялась недавно: 29\.09\.2026, 12 дней назад/);
  assert.match(h, /href="https:\/\/egrul\.nalog\.ru\/"/);
  assert.match(t, /Перед оплатой сверьте с ней подписанта и адрес в договоре\./);
  assert.match(t, /Запомнили эту проверку/);
  const seg = bezTegov(D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2026-10-11'), ls())));
  assert.match(seg, /менялась недавно: 11\.10\.2026, сегодня/);
  const odin = bezTegov(D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2026-10-10'), ls())));
  assert.match(odin, /1 день назад/);
  const god = bezTegov(D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2023-05-02'), ls())));
  assert.match(god, /3 года назад/);
});

test('первая проверка без даты — прежний текст', () => {
  const r = otvet('2026-10-11', null); r.dossier.data_dates = '';
  assert.strictEqual(D.htmlIzmeneniya(D.zapomnit(r, ls())),
    '<p class="izm izm--0">Запомнили эту проверку на' + NB + 'вашем устройстве. Проверите компанию снова — покажем, что изменилось.</p>');
});

test('повторная: запись обновилась, сравниваемое прежнее — одна справочная строка со ссылкой на выписку', () => {
  const l = ls();
  D.zapomnit(otvet('2026-09-01', '2026-07-29'), l);
  const rez = D.zapomnit(otvet('2026-10-11', '2026-09-20'), l);
  assert.strictEqual(rez.izm.length, 1);
  assert.strictEqual(rez.izm[0].ton, 'info');
  assert.strictEqual(rez.izm[0].t.split(NB).join(' '), 'Запись в ЕГРЮЛ обновлялась после вашей проверки: последнее изменение — 20.09.2026');
  const h = D.htmlIzmeneniya(rez);
  assert.match(h, /href="https:\/\/egrul\.nalog\.ru\/"/);
  assert.match(bezTegov(h), /Из записи ЕГРЮЛ мы сравниваем статус, руководителя, капитал, КПП и вид деятельности — они прежние\./);
});

test('повторная: смена руководителя уже названа — строку о записи не добавляем', () => {
  const l = ls();
  D.zapomnit(otvet('2026-09-01', '2026-07-29'), l);
  const nov = otvet('2026-10-11', '2026-09-20'); nov.company.director_since = '2026-09-20';
  const rez = D.zapomnit(nov, l);
  assert.ok(rez.izm.some((x) => /Руководитель сменился/.test(x.t)));
  assert.ok(!rez.izm.some((x) => /обновлялась после вашей проверки/.test(x.t)));
});

test('повторная: дата та же или старый снимок без даты — молчим', () => {
  let l = ls();
  D.zapomnit(otvet('2026-09-01', '2026-07-29'), l);
  assert.strictEqual(D.zapomnit(otvet('2026-10-11', '2026-07-29'), l).izm.length, 0);
  l = ls();
  const star = otvet('2026-09-01', null); star.dossier.data_dates = '';
  D.zapomnit(star, l);
  assert.strictEqual(D.zapomnit(otvet('2026-10-11', '2026-09-20'), l).izm.length, 0);
});

test('Паспорт (только чтение) видит ту же строку; тексты без оценок и обещаний', () => {
  const l = ls();
  D.zapomnit(otvet('2026-09-01', '2026-07-29'), l);
  const r = D.sravnitSnimki(otvet('2026-10-11', '2026-09-20'), l);
  assert.ok(r && r.izm.some((x) => /обновлялась после вашей проверки/.test(x.t)));
  const vse = bezTegov(D.htmlIzmeneniya(D.zapomnit(otvet('2026-10-11', '2026-10-01'), ls()))) + bezTegov(D.htmlIzmeneniya(r));
  assert.ok(!/надёжн|лучш|гарант|рекоменд|опасн|мошенн/i.test(vse));
});
