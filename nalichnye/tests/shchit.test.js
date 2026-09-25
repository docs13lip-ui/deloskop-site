// Автотесты «Наличные глазами банка». Запуск: node --test nalichnye/tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const E = require('../shchit-engine.js');
const TX = require('../shchit-texts.js');
const Dm = require('../shchit-demo.js');
const { build1C, D } = Dm;

const ORG = { inn: '7700000001', name: 'ООО «Тест»', account: '40702810000000000555' };
const IP = { inn: '500100732259', name: 'ИП Тестов Т. Т.', account: '40802810000000000777' };
function file(who, docs, extra) { return build1C(Object.assign({}, who, { from: D(2026, 7, 1), to: D(2026, 9, 30), docs: docs }, extra || {})); }
const buyer = { cpInn: '7701000001', cpName: 'ООО «Покупатель»' };
function sig(r, id) { return r.signals.find(s => s.id === id); }

test('кодировки: Windows-1251, UTF-8 и DOS (cp866)', () => {
  const txt = Dm.demo();
  for (const enc of ['cp1251', 'cp866']) {
    const bytes = execSync('iconv -f utf-8 -t ' + enc + '//TRANSLIT', { input: txt.replace('Кодировка=Windows', enc === 'cp866' ? 'Кодировка=DOS' : 'Кодировка=Windows') });
    const p = E.parse1C(new Uint8Array(bytes));
    assert.equal(p.docs.length, E.parse1C(txt).docs.length, enc);
    assert.match(p.docs[0].НазначениеПлатежа, /договору/);
  }
  const utf = E.parse1C(new TextEncoder().encode(txt));
  assert.ok(utf.docs.length > 30);
});

test('разбор: счёт из заголовка, многострочное назначение, оборванный файл', () => {
  const long = 'Оплата по договору поставки № 12 от 01.07.2026 за товар согласно УПД № 345 от 05.07.2026, в т.ч. НДС 22% — 21 639,34 руб.';
  const p = E.parse1C(file(ORG, [{ out: false, date: D(2026, 7, 6), sum: 120000, ...buyer, purpose: long }]));
  assert.deepEqual(p.accounts, [ORG.account]);
  assert.equal(p.docs[0].НазначениеПлатежа.replace(/\s+/g, ' '), long.slice(0, 80) + ' ' + long.slice(80));
  const cut = file(ORG, [{ out: false, date: D(2026, 7, 6), sum: 1, ...buyer, purpose: 'x' }]).replace(/КонецДокумента[\s\S]*$/, '');
  assert.throws(() => E.parse1C(cut), /NO_DOCS/);
  assert.throws(() => E.parse1C('просто текст'), /NOT_1C/);
});

test('классификация операций', () => {
  const docs = [
    { out: false, date: D(2026, 7, 1), sum: 500000, ...buyer, purpose: 'Оплата по счёту 1' },
    { out: true, type: 'Денежный чек', date: D(2026, 7, 2), sum: 50000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Выдача на заработную плату' },
    { out: false, type: 'Объявление на взнос наличными', date: D(2026, 7, 3), sum: 70000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Взнос наличных' },
    { out: false, date: D(2026, 7, 3), sum: 90000, cpInn: '7707083893', cpName: 'ПАО Банк', cpAcc: '30232810000000000001', purpose: 'Инкассированная выручка' },
    { out: true, date: D(2026, 7, 6), sum: 30000, kbk: '18201061201010000510', cpInn: '7727406020', cpName: 'Казначейство России', cpAcc: '03100643000000018500', purpose: 'Единый налоговый платёж' },
    { out: true, date: D(2026, 7, 7), sum: 100000, cpInn: ORG.inn, cpName: ORG.name, cpAcc: '40702810400000000999', purpose: 'Перевод собственных средств на счёт в другом банке' },
    { out: true, date: D(2026, 7, 8), sum: 200000, cpName: 'Реестр', cpAcc: '40817810000000000077', purpose: 'Заработная плата за июнь по реестру № 5' },
    { out: true, date: D(2026, 7, 8), sum: 15000, cpInn: '', cpName: 'Иванов И. И.', cpAcc: '40817810000000000011', purpose: 'Возврат займа' },
    { out: true, date: D(2026, 7, 9), sum: 990, cpInn: '7707083893', cpName: 'ПАО Банк', cpAcc: '70601810000000000001', purpose: 'Комиссия за ведение счёта' },
    { out: true, date: D(2026, 7, 9), sum: 45000, cpInn: '7702000011', cpName: 'ООО «Склад»', purpose: 'Аренда за июль' },
    { out: true, date: D(2026, 7, 10), sum: 20000, cpInn: '7707083893', cpName: 'ПАО Банк', cpAcc: '30232810000000000001', purpose: 'Снятие наличных в банкомате по корпоративной карте' }
  ];
  const c = E.classify(E.parse1C(file(ORG, docs)));
  assert.equal(c.client.inn, ORG.inn);
  assert.deepEqual(c.ops.map(o => o.kind), ['counterparty', 'cash_out', 'cash_in', 'cash_in', 'tax', 'own', 'salary', 'person', 'fee', 'counterparty', 'cash_out']);
  assert.ok(c.ops[9].ordinary);
});

test('чистая компания — «Спокойно» и сильные стороны', () => {
  const docs = [];
  [7, 8, 9].forEach(m => {
    docs.push({ out: false, date: D(2026, m, 3), sum: 2000000, ...buyer, purpose: 'Оплата по договору' });
    docs.push({ out: true, date: D(2026, m, 6), sum: 1200000, cpInn: '7702000010', cpName: 'ООО «Снаб»', purpose: 'Оплата за товар' });
    docs.push({ out: true, date: D(2026, m, 7), sum: 90000, cpInn: '7702000011', cpName: 'ООО «Склад»', purpose: 'Аренда офиса' });
    docs.push({ out: true, date: D(2026, m, 25), sum: 60000, kbk: '18201061201010000510', cpInn: '7727406020', cpName: 'Казначейство', cpAcc: '03100643000000018500', purpose: 'ЕНП' });
    docs.push({ out: true, date: D(2026, m, 20), sum: 300000, cpAcc: '40817810000000000077', cpName: 'Реестр', purpose: 'Заработная плата по реестру' });
    docs.push({ out: true, type: 'Денежный чек', date: D(2026, m, 21), sum: 40000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Под отчёт на закупку канцтоваров по счёту № 5' });
  });
  const r = E.analyze(E.parse1C(file(ORG, docs, { closing: 900000 })));
  assert.equal(r.level, 0, JSON.stringify(r.signals.filter(s => s.level)));
  assert.deepEqual(r.todo, []);
  assert.ok(r.strengths.includes('tax_ok') && r.strengths.includes('ordinary_ok') && r.strengths.includes('salary_card'));
  assert.equal(r.totals.vague, 0, 'подотчёт с понятной целью — не «без следа»');
});

test('транзит считается в рабочих днях: пятница → вторник да, → среда нет', () => {
  const fri = D(2026, 7, 3); // пятница
  const base = [{ out: false, date: fri, sum: 1000000, ...buyer, purpose: 'Оплата' }];
  const tue = E.analyze(E.parse1C(file(ORG, base.concat([{ out: true, type: 'Денежный чек', date: D(2026, 7, 7), sum: 600000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Снятие' }]))));
  const wed = E.analyze(E.parse1C(file(ORG, base.concat([{ out: true, type: 'Денежный чек', date: D(2026, 7, 8), sum: 600000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Снятие' }]))));
  assert.equal(sig(tue, 'transit').amount, 600000);
  assert.equal(sig(tue, 'transit').level, 2);
  assert.equal(sig(wed, 'transit').amount, 0);
});

test('операции от 1 млн ₽ (ст. 6 115-ФЗ) и пометка для ИП', () => {
  const d = [{ out: false, date: D(2026, 7, 1), sum: 3000000, ...buyer, purpose: 'Оплата' },
    { out: true, type: 'Денежный чек', date: D(2026, 7, 20), sum: 1000000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Снятие' },
    { out: true, type: 'Денежный чек', date: D(2026, 7, 21), sum: 999999.99, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Снятие' }];
  const r = E.analyze(E.parse1C(file(ORG, d)));
  assert.equal(sig(r, 'big_cash').value, 1, 'ровно 1 млн — да, 999 999,99 — нет');
  const ip = E.analyze(E.parse1C(file(IP, d.map(x => Object.assign({}, x, { cpInn: x.cpInn === ORG.inn ? IP.inn : x.cpInn })))));
  assert.equal(sig(ip, 'big_cash').note, 'ip');
});

test('взносы наличных по 1-МР: 31 млн за 30 дней при обычном приходе 2 млн — опасно', () => {
  const d = [];
  [4, 5, 6].forEach(m => d.push({ out: false, date: D(2026, m, 10), sum: 2000000, ...buyer, purpose: 'Оплата' }));
  for (let i = 0; i < 10; i++) d.push({ out: false, type: 'Объявление на взнос наличными', date: D(2026, 7, 6 + i), sum: 3100000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Взнос наличных' });
  const r = E.analyze(E.parse1C(build1C(Object.assign({}, ORG, { from: D(2026, 4, 1), to: D(2026, 7, 31), docs: d }))));
  const s = sig(r, 'deposit_big');
  assert.ok(s && s.level === 2 && s.value === 31000000);
  assert.equal(r.level, 2);
  // Розница с той же картиной без превышения порога — не шумим долей взносов
  const small = d.slice(0, 3).concat([{ out: false, type: 'Объявление на взнос наличными', date: D(2026, 7, 6), sum: 3000000, cpInn: ORG.inn, cpName: ORG.name, purpose: 'Сдача выручки' }]);
  const pr = E.parse1C(build1C(Object.assign({}, ORG, { from: D(2026, 4, 1), to: D(2026, 7, 31), docs: small })));
  assert.ok(sig(E.analyze(pr), 'deposit_share'));
  assert.equal(sig(E.analyze(pr, { cashBusiness: true }), 'deposit_share'), undefined);
});

test('ИП: вывод себе почти всего при малых налогах — опасно', () => {
  const d = [];
  [7, 8, 9].forEach(m => {
    d.push({ out: false, date: D(2026, m, 5), sum: 800000, ...buyer, purpose: 'Оплата услуг' });
    d.push({ out: true, date: D(2026, m, 6), sum: 760000, cpInn: IP.inn, cpName: 'Тестов Т. Т.', cpAcc: '40817810000000000555', purpose: 'Перевод собственных средств' });
  });
  const r = E.analyze(E.parse1C(file(IP, d)));
  assert.equal(r.client.isIP, true);
  assert.equal(sig(r, 'ip_self').level, 2);
  assert.equal(sig(r, 'transit').level, 2);
  assert.ok(sig(r, 'tax_share').level >= 1);
});

test('демо: признаки, деньги и три дела', () => {
  const r = E.analyze(E.parse1C(Dm.demo()));
  const ids = r.signals.filter(s => s.level).map(s => s.id);
  for (const id of ['cash_share', 'cash_week', 'transit', 'tax_share', 'big_cash', 'cash_growth', 'vague_cash']) assert.ok(ids.includes(id), id);
  assert.equal(r.level, 2);
  assert.equal(r.todo.length, 3);
  assert.equal(r.money.balance, 1265000);
  assert.ok(Math.abs(r.money.atStake - (r.money.balance + r.money.inflowAtStake)) < 0.02);
  assert.equal(r.money.hiddenSalaryRisk, Math.round(r.totals.vague * 0.43 * 100) / 100);
});

test('тексты: у каждого признака есть заголовок, ≥3 варианта и дела; вариант стабилен', () => {
  for (const id of ['cash_share', 'cash_week', 'transit', 'tax_share', 'pass_through', 'big_cash', 'cash_growth', 'ip_self', 'persons', 'deposit_big', 'deposit_share', 'vague_cash', 'no_ordinary']) {
    const t = TX.signals[id];
    assert.ok(t && t.title && t.text.length >= 3 && t.todo.length >= 2, id);
    for (const v of t.text) assert.ok(v.split(/[.!?]\s/).every(f => f.split(/\s+/).length <= 32), 'длинная фраза в ' + id);
  }
  const a = E.pickVariant(TX.signals.transit.text, '7700000001', 'transit');
  assert.equal(a, E.pickVariant(TX.signals.transit.text, '7700000001', 'transit'));
  const set = new Set(['7700000001', '7700000002', '7700000003', '7700000004', '7700000005', '7700000006'].map(i => E.pickVariant(TX.signals.transit.text, i, 'transit')));
  assert.ok(set.size >= 2, 'у разных клиентов — разные тексты');
});

test('без сети: движок не обращается к fetch/XMLHttpRequest', () => {
  const fs = require('node:fs');
  for (const f of ['shchit-engine.js', 'shchit-ui.js', 'shchit-texts.js', 'shchit-demo.js']) {
    const src = fs.readFileSync(require('node:path').join(__dirname, '..', f), 'utf8');
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/, f);
  }
});
