// kommentarii-signal-id-v1 — «Комментарий команды Делоскопа» ищется по коду признака, а не только по тексту заголовка
// (Master 30.10, «Архитектура»: «переименование текста сигнала не меняет правило»; продолжение signal-id-v1, PR #217).
// Воспроизведение на main 35e0c47f: tax_debt с заголовком «Сумма к уплате в бюджет» — комментария нет (re по заголовку
// не совпал), а «Условия сделки» тот же признак уже узнают по коду. Совместимость: для нынешних заголовков API запись та же.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../js/kommentarii.js');
const U = require('../js/usloviya.js');
const S = require('../data/kommentarii.json');

const bezKoda = (s) => { const c = Object.assign({}, s); delete c.id; delete c.signal_id; delete c.rule_id; return c; };
const idZ = (s) => { const z = K.zapis(S, s); return z ? z.id : null; };

test('воспроизведение: tax_debt переименован — комментарий тот же, что у «Задолженность по налогам»', () => {
  const nov = { id: 'tax_debt', title: 'Сумма к уплате в бюджет', status: 'bad', detail: '120 000 ₽' };
  assert.strictEqual(idZ(bezKoda(nov)), null, 'по одному заголовку записи нет — так было на main');
  const a = K.najti(S, nov), b = K.najti(S, { id: 'tax_debt', title: 'Задолженность по налогам', status: 'bad', detail: '120 000 ₽' });
  assert.ok(b, 'у долга по налогам есть утверждённый красный текст');
  assert.deepStrictEqual(a, b);
});

test('код из signal_id / rule_id важнее id ответа; неизвестный код — как раньше, по заголовку', () => {
  assert.strictEqual(K.kodSignala({ signal_id: 'fssp', id: 'tax_debt' }), 'fssp');
  assert.strictEqual(K.kodSignala({ rule_id: 'tax_debt' }), 'tax_debt');
  assert.strictEqual(K.kodSignala({ id: 'status' }), null, 'общий id — без кода');
  assert.strictEqual(K.kodSignala({ id: 'constructor' }), null);
  assert.strictEqual(idZ({ signal_id: 'novyj_kod', title: 'Задолженность по налогам', status: 'bad' }), 'nedoimka');
  assert.strictEqual(idZ({ signal_id: 'fssp', title: 'Взыскания', status: 'warn', detail: '2 производства' }), 'fssp');
});

test('uslovie работает и по коду: «Работники · 0» → net_sotrudnikov, «· 40» → shtat', () => {
  assert.strictEqual(idZ({ id: 'employees', title: 'Работники', status: 'warn', detail: '0' }), 'net_sotrudnikov');
  assert.strictEqual(idZ({ id: 'employees', title: 'Работники', status: 'ok', detail: '40' }), 'shtat');
  assert.strictEqual(idZ({ id: 'age', title: 'Дата создания', status: 'warn', detail: '5 мес' }), 'molodaya');
  assert.strictEqual(idZ({ id: 'age', title: 'Дата создания', status: 'ok', detail: '7 лет' }), 'vozrast');
});

test('совместимость: для заголовков, которые сегодня отдаёт /api/check, запись побайтно прежняя', () => {
  const API = [
    ['status', 'Статус', ['Действующая', 'В процессе ликвидации']], ['address', 'Адрес', ['г. Москва', 'Есть отметка о недостоверности']],
    ['age', 'Возраст компании', ['5 мес', '11 лет', '1 год']], ['tax_debt', 'Задолженность по налогам', ['Нет', '120 000 ₽']],
    ['tax_debt', 'Долги по налогам', ['Нет']], ['employees', 'Сотрудники', ['0', '1', '25', 'нет']],
    ['management', 'Массовый руководитель', ['']], ['mass', 'Массовый адрес', ['']], ['mass_address', 'Массовый адрес', ['11 компаний']],
    ['mass_dir', 'Массовый руководитель', ['']], ['fssp', 'ФССП', ['Нет производств', '3 производства']],
    ['dynamics', 'Финансовая динамика по годам', ['']]
  ];
  API.forEach(([id, title, det]) => det.forEach((d) => ['ok', 'warn', 'bad'].forEach((st) => {
    const s = { id, title, detail: d, status: st };
    assert.strictEqual(idZ(s), idZ(bezKoda(s)), id + ' / ' + title + ' · ' + d);
    assert.deepStrictEqual(K.najti(S, s), K.najti(S, bezKoda(s)), 'najti ' + id + ' · ' + d);
  })));
});

test('таблица IZ_API — та же, что в js/usloviya.js; коды kody — из словаря signal_id', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  const blok = /var IZ_API = \{([\s\S]*?)\};/.exec(src)[1];
  const u = {}; blok.replace(/(\w+):\s*'(\w+)'/g, (m, a, b) => { u[a] = b; });
  assert.deepStrictEqual(K.IZ_API, u);
  Object.keys(u).forEach((k) => assert.strictEqual(U.signalId({ id: k, title: 'x' }).id, u[k]));
  const sig = /var SIGNALY = \[([\s\S]*?)\n  \];/.exec(src)[1];
  const kody = new Set([...sig.matchAll(/\['(\w+)', '\w+'/g)].map((m) => m[1]));
  let n = 0;
  S.signaly.forEach((z) => (z.kody || []).forEach((k) => {
    n++;
    assert.ok(kody.has(k), z.id + ': код ' + k + ' нет в SIGNALY js/usloviya.js');
    assert.ok(!z.kak && z.re, z.id + ': код — только у записи со своими текстами и re');
  }));
  assert.ok(n >= 14);
});
