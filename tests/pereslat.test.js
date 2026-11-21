// pereslat-v1 [Ночные запуски] 21.11: «Переслать тому, кто платит» (ТЗ [Стратег] 17.11, Очередь п. 533).
// node --test tests/pereslat.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/pereslat.js');
const S = require('../js/schetchik.js');
const U = require('../js/usloviya.js');
const I = require('../js/imya.js');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const r = (o) => Object.assign({ company: { inn: '7604193710', name_short: 'ООО "ТГК-2 ЭНЕРГОСБЫТ"', kind: 'LEGAL' },
  report_id: 'Xw6t-RBMhkrb', checked_at: '2026-11-21T04:07:51.245666+03:00', risk_level: 'medium',
  verdict: 'Работать можно. Есть один момент: задолженность по налогам', indeks: 67,
  dossier: { concerns: ['Убытки несколько лет подряд'] } }, o || {});

test('12 цифр, ИП и своя компания — ссылки нет', () => {
  assert.strictEqual(P.mozhno(r({ company: { inn: '770000000012' } })), false);
  assert.strictEqual(P.mozhno(r({ company: { inn: '7604193710', kind: 'INDIVIDUAL' } })), false);
  assert.strictEqual(P.mozhno(r(), true), false, 'Щит — своя компания');
  assert.strictEqual(P.mozhno({}), false);
  assert.strictEqual(P.mozhno(r()), true);
  assert.strictEqual(P.tekst(r({ company: { inn: '770000000012' } })), '');
});

test('строка: название ёлочками, ИНН, дата сведений по Москве, адрес', () => {
  assert.strictEqual(P.tekst(r(), null, I),
    'Проверка перед оплатой: ООО «ТГК-2 ЭНЕРГОСБЫТ», ИНН 7604193710. Сведения на 21.11.2026. https://deloskop.ru/report.html?id=Xw6t-RBMhkrb&utm_source=pereslali&utm_medium=ssylka');
  assert.strictEqual(P.data('2026-11-20T22:30:00Z'), '21.11.2026', 'после 21:00 UTC — уже следующий день в Москве');
  assert.strictEqual(P.data('2026-11-21'), '21.11.2026');
  assert.strictEqual(P.data(''), '');
  assert.strictEqual(P.stroka(r({ checked_at: null })), 'Проверка перед оплатой: ООО «ТГК-2 ЭНЕРГОСБЫТ», ИНН 7604193710.', 'нет даты — без «Сведения на»');
});

test('в тексте нет слов вывода, Индекса, плюсов и минусов', () => {
  const t = P.tekst(r(), { '7604193710': '/company/7604193710-tgk-2-energosbyt/' }, I);
  for (const z of ['Работать можно', 'задолженность', 'Убытки', '67', 'Индекс', 'риск', 'минус', 'плюс', 'сигнал', 'рекоменд'])
    assert.ok(!t.toLowerCase().includes(z.toLowerCase()), 'нет «' + z + '»: ' + t);
});

test('адрес: номер проверки → карточка → главная; метки на месте', () => {
  const kart = { '7604193710': '/company/7604193710-tgk-2-energosbyt/' };
  assert.strictEqual(P.adres(r(), kart), 'https://deloskop.ru/report.html?id=Xw6t-RBMhkrb&utm_source=pereslali&utm_medium=ssylka',
    'есть номер — тот же отчёт на ту же дату, без новой проверки');
  assert.strictEqual(P.adres(r({ report_id: null }), kart), 'https://deloskop.ru/company/7604193710-tgk-2-energosbyt/?utm_source=pereslali&utm_medium=ssylka');
  assert.strictEqual(P.adres(r({ report_id: null }), {}), 'https://deloskop.ru/?inn=7604193710&utm_source=pereslali&utm_medium=ssylka');
  assert.strictEqual(P.adres(r({ report_id: '../x' }), {}), 'https://deloskop.ru/?inn=7604193710&utm_source=pereslali&utm_medium=ssylka', 'чужой номер в адрес не идёт');
  assert.strictEqual(P.adres(r({ report_id: null }), { '7604193710': 'javascript:alert(1)' }), 'https://deloskop.ru/?inn=7604193710&utm_source=pereslali&utm_medium=ssylka');
  for (const u of [P.adres(r(), kart), P.adres(r({ report_id: null }), kart), P.adres(r({ report_id: null }), {})]) {
    const q = new URL(u).searchParams;
    assert.strictEqual(q.get('utm_source'), 'pereslali'); assert.strictEqual(q.get('utm_medium'), 'ssylka');
    assert.ok(S.prishelPoPeresylke(new URL(u).search), 'счётчик узнаёт метку: ' + u);
  }
  assert.strictEqual(S.prishelPoPeresylke('?utm_source=pereslali2'), false);
  assert.strictEqual(S.prishelPoPeresylke('?x=utm_source=pereslali'), false);
});

test('карта карточек — из Условий сделки (один запрос за страницу), выдача — только путь /company/', () => {
  assert.strictEqual(typeof U.kartochki, 'function');
  const m = U.kartaKartochek('<loc>https://deloskop.ru/company/7604193710-tgk-2-energosbyt/</loc>');
  assert.strictEqual(m['7604193710'], '/company/7604193710-tgk-2-energosbyt/');
});

test('способ: «Поделиться» — только на сенсорном экране, иначе копирование', () => {
  assert.strictEqual(P.sposob(true, true, true), 'share');
  assert.strictEqual(P.sposob(true, false, true), 'copy');
  assert.strictEqual(P.sposob(false, true, true), 'copy');
  assert.strictEqual(P.sposob(false, false, false), 'zapas');
});

test('события счётчика: только вид, без ИНН и адреса', () => {
  assert.strictEqual(S.VIDY.pereslal, 1); assert.strictEqual(S.VIDY.prishel_po_peresylke, 1);
  assert.deepStrictEqual(S.teloSobytiya('pereslal', { host: 'deloskop.ru', pathname: '/' }), { sobytie: 'pereslal' });
  assert.strictEqual(S.teloSobytiya('pereslal', { host: 'deloskop.ru', pathname: '/', dnt: '1' }), null, '«Не отслеживать» — не шлём');
});

test('разметка: кнопка в полосе действий отчёта, в пакете «otchet» до otchet.js', () => {
  assert.match(P.html(), /^<button class="ot-lnk ot-lnk--knopka" type="button" data-pereslat>Переслать тому, кто платит<\/button>$/);
  const o = chitat('js/otchet.js');
  assert.ok(o.includes("htmlDejstviya(r, svoj, g) + (pereslat ? PS.html() : '')"));
  assert.ok(o.includes('PS.mozhno(r, svoj)'));
  const p = JSON.parse(chitat('partials/sborka.json')).pakety.otchet;
  assert.ok(p.indexOf('js/pereslat.js') >= 0 && p.indexOf('js/pereslat.js') < p.indexOf('js/otchet.js'));
  assert.match(chitat('css/otchet.css'), /\.ot-lnk--knopka\{background:none;border:0/);
});
