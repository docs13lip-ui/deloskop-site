// Тесты «Условий сделки». Запуск: node tests/usloviya.test.js
'use strict';
var assert = require('assert');
var U = require('../js/usloviya.js');
var NB = ' ';
var n = 0;
function t(name, fn) { fn(); n++; console.log('✓ ' + name); }
function sig(title, status, detail) { return { title: title, status: status, detail: detail || '' }; }
var NOW = '2026-09-25T09:00:00+03:00';
function resp(o) {
  return Object.assign({ checked_at: NOW, risk_level: 'low', company: { inn: '7700000000', name_short: 'ООО «Тест»', status: 'ACTIVE', reg_date: '2015-03-01' }, signals: [] }, o || {});
}

t('чистая старая компания → «Работать можно», предел 3 млн по возрасту', function () {
  var v = U.decide(resp({ signals: [sig('Недостоверные сведения в ЕГРЮЛ', 'ok', 'Нет')] }));
  assert.strictEqual(v.tone, 'go');
  assert.strictEqual(v.headline, 'Работать можно');
  assert.strictEqual(v.cap, 3000000);
});

t('выручка известна → предел = две недели выручки, округлён вниз', function () {
  var v = U.decide(resp({ dossier: { kpi: [{ label: 'Выручка', value: 52000000 }] } }));
  assert.strictEqual(v.cap, 2000000); // 52 млн / 26
});

t('пример из стратегии: 7 месяцев + смена директора → предел со «вдвое меньше»', function () {
  var v = U.decide(resp({ risk_level: 'medium', company: { inn: '7700000001', name_short: 'ООО «Юный»', status: 'ACTIVE', reg_date: '2026-02-10' },
    signals: [sig('Руководитель сменился недавно', 'warn', 'Внимание')] }));
  assert.strictEqual(v.tone, 'cap');
  assert.strictEqual(v.cap, 150000); // 300 000 / 2
  assert.strictEqual(v.headline, 'Можно, предоплата — до' + NB + '150' + NB + '000' + NB + '₽');
  assert.ok(v.reasons.some(function (r) { return /компании 7/.test(r); }), v.reasons.join('|'));
  assert.ok(v.docs.some(function (d) { return d.id === 'powerNew'; }));
});

t('молодая компания с огромной выручкой всё равно упирается в потолок возраста', function () {
  var v = U.decide(resp({ company: { inn: '7700000002', status: 'ACTIVE', reg_date: '2026-05-01' }, dossier: { kpi: [{ label: 'Выручка', value: 900000000 }] } }));
  assert.strictEqual(v.tone, 'cap');        // «молодость» — замечание
  assert.strictEqual(v.cap, 50000);          // до 6 мес — 100 000, пополам
});

t('недостоверность → «Не платите вперёд», предел 0, документы про адрес', function () {
  var v = U.decide(resp({ risk_level: 'high', signals: [sig('Недостоверные сведения в ЕГРЮЛ', 'bad', 'Адрес')] }));
  assert.strictEqual(v.tone, 'stop');
  assert.strictEqual(v.cap, 0);
  var ids = v.docs.map(function (d) { return d.id; });
  assert.ok(ids.indexOf('fixRecord') >= 0 && ids.indexOf('premises') >= 0, ids.join(','));
});

t('ликвидированная → «Сделку не заключать»', function () {
  var v = U.decide(resp({ company: { inn: '7700000003', status: 'LIQUIDATED', reg_date: '2010-01-01' } }));
  assert.strictEqual(v.headline, 'Сделку не заключать');
  assert.ok(/недействителен/.test(v.advice));
});

t('налоговый долг → только по факту + справка КНД 1120101', function () {
  var v = U.decide(resp({ risk_level: 'medium', signals: [sig('Задолженность по налогам', 'bad', '412 000 ₽')] }));
  assert.strictEqual(v.tone, 'post');
  assert.ok(v.docs.some(function (d) { return d.id === 'taxCert'; }));
  assert.ok(/412/.test(v.reasons[0]), v.reasons[0]);
});

t('три предупреждения → только по факту', function () {
  var v = U.decide(resp({ signals: [sig('Руководитель сменился недавно', 'warn'), sig('Налоговая нагрузка', 'warn', 'Ниже отрасли'), sig('Штрафы за налоговые правонарушения', 'warn', 'Есть')] }));
  assert.strictEqual(v.tone, 'post');
});

t('ЗСК высокий → стоп; средний → запасной банк в документах', function () {
  assert.strictEqual(U.decide(resp({ zsk: { level: 'high' } })).tone, 'stop');
  var v = U.decide(resp({ zsk: { level: 'medium' } }));
  assert.strictEqual(v.tone, 'cap');
  assert.ok(v.docs.some(function (d) { return d.id === 'bank'; }));
});

t('неизвестный плохой признак не теряется', function () {
  var v = U.decide(resp({ signals: [sig('Что-то новое из будущего модуля', 'bad', 'Да')] }));
  assert.strictEqual(v.tone, 'post');
  assert.ok(/что-то новое/.test(v.reasons[0]));
});

t('деньги на кону, ОСН: НДС 22/122, прибыль 25%, штрафы 20% и 40%', function () {
  var s = U.atStake(1220000, 'osno');
  assert.strictEqual(Math.round(s.vat), 220000);
  assert.strictEqual(Math.round(s.soft), 264000);           // 220 000 × 1,2
  assert.strictEqual(Math.round(s.hard), 658000);           // (220 000 + 250 000) × 1,4 = 658 000
});

t('деньги на кону, УСН: «доходы минус расходы» — 15% × 1,4; «доходы» — ноль', function () {
  assert.strictEqual(Math.round(U.atStake(1000000, 'usn_dr').hard), 210000);
  assert.ok(U.atStake(1000000, 'usn_d').zero);
  assert.strictEqual(U.atStake(0, 'osno'), null);
});

t('разбор суммы: пробелы, «тыс», «млн», запятая', function () {
  assert.strictEqual(U.parseAmount('1 500 000'), 1500000);
  assert.strictEqual(U.parseAmount('500 тыс'), 500000);
  assert.strictEqual(U.parseAmount('1,2 млн'), 1200000);
  assert.strictEqual(U.parseAmount('абв'), 0);
});

t('соразмерность (п. 16 письма ФНС): мелкая сделка — 2 документа, крупная — больше', function () {
  var small = U.decide(resp(), { amount: 50000 }), big = U.decide(resp(), { amount: 5000000 });
  assert.strictEqual(small.docs.length, 2);
  assert.ok(big.docs.length >= 5, big.docs.length);
});

t('предоплата сверх предела → доля слитно со знаком %', function () {
  var v = U.decide(resp({ company: { inn: '7700000004', status: 'ACTIVE', reg_date: '2026-02-10' } }), { amount: 1000000 });
  assert.strictEqual(v.cap, 150000);
  assert.ok(/\(15% суммы\)/.test(v.prepay), v.prepay);
});

t('письмо: ИНН, сумма, нумерация, ссылка на письмо ФНС, без неразрывных пробелов в теме', function () {
  var v = U.decide(resp(), { amount: 2000000 });
  assert.ok(/ИНН 7700000000/.test(v.letter.body));
  assert.ok(/2 000 000 ₽/.test(v.letter.body));
  assert.ok(/1\. /.test(v.letter.body) && /БВ-4-7\/3060@/.test(v.letter.body));
  assert.ok(v.letter.subject.indexOf(NB) < 0);
});

t('ИП на УСН «доходы» — без документа о режиме налогов', function () {
  var v = U.decide(resp(), { amount: 3000000, regime: 'usn_d' });
  assert.ok(!v.docs.some(function (d) { return d.id === 'regime'; }));
});

t('не больше 7 документов даже при всех бедах', function () {
  var v = U.decide(resp({ zsk: { level: 'medium' }, signals: [sig('Недостоверные сведения', 'warn'), sig('Задолженность по налогам', 'warn'), sig('Долги у приставов', 'warn'), sig('Руководитель сменился', 'warn'), sig('Массовый адрес', 'warn')] }), { amount: 9e6 });
  assert.ok(v.docs.length <= 7);
});

t('niceFloor: круглые ориентиры вниз', function () {
  assert.strictEqual(U.niceFloor(87400), 80000);
  assert.strictEqual(U.niceFloor(1237000), 1200000);
  assert.strictEqual(U.niceFloor(3000), 10000);
  assert.strictEqual(U.niceFloor(0), 0);
});


t('mount без данных о компании бросает ошибку — страница покажет запасной вывод', function () {
  assert.throws(function () { U.mount({ ownerDocument: {} }, []); });
});
t('в письме — вежливые формулировки, без «нового директора»', function () {
  var v = U.decide(resp({ signals: [sig('Руководитель сменился недавно', 'warn')] }), { amount: 2000000 });
  assert.ok(/действующего директора/.test(v.letter.body));
  assert.ok(!/нового директора/.test(v.letter.body));
  v.docs.forEach(function (d) { assert.ok(d.ask, d.id); });
});
t('полномочия: ссылки на проверку МЧД и нотариальной доверенности', function () {
  var d = U.decide(resp()).docs[0];
  assert.strictEqual(d.id, 'power');
  assert.ok(d.links.some(function (l) { return /m4d\.nalog\.gov\.ru/.test(l.u); }));
  assert.ok(d.links.some(function (l) { return /reestr-dover\.ru/.test(l.u); }));
});
console.log('\nПройдено тестов: ' + n);
