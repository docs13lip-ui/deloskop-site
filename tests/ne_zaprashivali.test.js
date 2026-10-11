// [Ночные-3] ne-zaprashivali-v1: внешние реестры, которые API (damia v1.4) метит sostoyanie = not_checked, — «не проверяли»,
// а не «не ответили»: (1) опись «Откуда данные» не считает их запрошенными; (2) «Как посчитали предел» не пишет
// «Из внешних реестров ответили 0 из 7»; (3) PDF-досье — без «Запомнили на устройстве», давность — от дня проверки.
// node --test tests/ne_zaprashivali.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/otkuda.js');
const U = require('../js/usloviya.js');
const D = require('../js/dinamika.js');
const NB = ' ';
const PRICH = 'эти реестры мы пока не проверяем';

// форма живого ответа /api/check 11.10.2026 (damia v1.4); компания вымышленная
function damia(sost) {
  const o = {};
  [['sudy', 'Арбитражные суды', 'https://kad.arbitr.ru/'], ['bankrotstvo', 'Банкротство', 'https://bankrot.fedresurs.ru/'], ['fssp', 'Приставы', 'https://fssp.gov.ru/iss/ip/'],
    ['priostanovki', 'Счета: решения ФНС о приостановлении', 'https://service.nalog.ru/bi.do'], ['mery', 'Обеспечительные меры ФНС', ''],
    ['rnp', 'Недобросовестные поставщики (РНП)', ''], ['kontrakty', 'Госконтракты', '']]
    .forEach(([k, n, u]) => { o[k] = { nazvanie: n, status: 'ne_provereno', sostoyanie: sost, prichina: PRICH, proverit_samim: u || undefined }; });
  o.polnota = { provereno: 0, iz: 7 }; o.platnyj = false; o.versiya = 'damia-v1.4';
  return o;
}
function otvet(sost, over) {
  return Object.assign({
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', reg_date: '2015-03-10', state_actuality_date: '2026-07-29' },
    risk_level: 'low', risk_title: 'Низкий риск', verdict: 'Работать можно.', checked_at: '2026-10-11',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' },
    ],
    damia: damia(sost),
    dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на 11.10.2026; последнее изменение записи ЕГРЮЛ/ЕГРИП — 29.07.2026; задолженность — на 01.09.2026',
      charts: { revenue: [{ year: 2024, value: 100e6 }, { year: 2025, value: 120e6 }] } },
  }, over || {});
}
const txt = (h) => h.replace(/<[^>]+>/g, '').split(NB).join(' ');

test('опись: not_checked — «не проверяли», в счёт запрошенных не идут', () => {
  const o = O.istochniki(otvet('not_checked'));
  assert.strictEqual(o.nep, 7);
  assert.strictEqual(o.oprosheno, o.otvetili, 'запрошенные = ответившие');
  const h = O.html(otvet('not_checked')), t = txt(h);
  assert.match(t, /ответили (\d+) из \1 запрошенных · 7 реестров не проверяли · проверка 11\.10\.2026/);
  // prichina-nep-v1: общая строка без повтора «Не проверяли … : эти реестры мы пока не проверяем»
  assert.ok(t.includes('Не проверяли 7 реестров — мы их пока не проверяем.'));
  assert.ok(!/Не ответили \d/.test(t) && !/ не ответил/.test(h.replace(/aria-label="[^"]*"/g, '')), 'нет «не ответил»');
  assert.strictEqual((h.match(/otk__r--nep/g) || []).length, 7);
  assert.ok(h.includes('href="https://kad.arbitr.ru/"'), 'ссылка «проверьте сами» осталась');
  assert.ok(t.includes('– не проверяли — не значит «не нашли»'));
  assert.ok(!t.includes('не ответил'), 'строка без ссылки — «не проверяли», а не «не ответил»');
});

test('опись: без маркера not_checked — как раньше («не ответили»)', () => {
  const h = O.html(otvet(undefined)), t = txt(h);
  assert.ok(t.includes('Не ответили 7 из'));
  assert.ok(!t.includes('не проверяли ·'));
  assert.strictEqual(O.istochniki(otvet(undefined)).nep, 0);
});

test('предел: «ответили 0 из 7» не пишем, когда реестры не запрашивали; при сбое — пишем', () => {
  const a = U.decide(otvet('not_checked'));
  assert.ok(a.kak.ne, 'строка «Не проверяли» есть');
  assert.doesNotMatch(a.kak.ne, /ответили \d+ из \d+/);
  const b = U.decide(otvet(undefined));
  assert.match(b.kak.ne, /Из внешних реестров ответили 0 из 7/);
});

function ls() { return { d: {}, getItem(k) { return this.d[k] || null; }, setItem(k, v) { this.d[k] = String(v); } }; }

test('PDF-досье: дата записи ЕГРЮЛ — от дня проверки, без «запомнили на устройстве»', () => {
  const h = D.html(otvet('not_checked'), { balans: false, dokument: true, ls: ls() }), t = txt(h);
  assert.ok(t.includes('Последнее изменение записи в ЕГРЮЛ — 29.07.2026, за 2 месяца до проверки.'));
  assert.ok(!t.includes('Запомнили'));
  assert.ok(!t.includes('назад'));
  // экран — как в zapis-egryul-v1
  const e = txt(D.html(otvet('not_checked'), { ls: ls() }));
  assert.ok(e.includes('2 месяца назад') && e.includes('Запомнили'));
});

test('PDF-досье: свежая запись (≤ 30 дней) — со ссылкой на выписку; в день проверки — «в день проверки»', () => {
  const r = otvet('not_checked'); r.company.state_actuality_date = '2026-10-01';
  const t = txt(D.html(r, { dokument: true, ls: ls() }));
  assert.ok(t.includes('29.07') === false && t.includes('01.10.2026, за 10 дней до проверки. Что именно изменилось, видно в выписке ЕГРЮЛ'));
  const r0 = otvet('not_checked'); r0.company.state_actuality_date = '2026-10-11';
  assert.ok(txt(D.html(r0, { dokument: true, ls: ls() })).includes('11.10.2026, в день проверки.'));
});

test('report.html зовёт Динамику в режиме документа', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'report.html'), 'utf8');
  assert.ok(s.includes('Dinamika.html(R,{balans:false,dokument:true})'));
});
