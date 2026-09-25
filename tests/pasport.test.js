// Тесты Паспорта добросовестности: node tests/pasport.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, '..', 'pasport', 'engine.js'));
const Q = require(path.join(__dirname, '..', 'pasport', 'qr.js'));

let n = 0;
function t(name, fn) { fn(); n++; console.log('✓ ' + name); }

t('ИНН: контрольные цифры организаций и ИП', () => {
  assert.ok(E.innValid('4826147043'));      // ООО «Леон», Липецк
  assert.ok(E.innValid('7707083893'));      // Сбербанк
  assert.ok(E.innValid('0012345673'));      // вымышленный, регион 00
  assert.ok(!E.innValid('4826147044'));
  assert.ok(!E.innValid('482614704'));
  assert.ok(E.innValid('500100732259'));    // пример ИП из документации ФНС
  assert.ok(!E.innValid('500100732250'));
  assert.ok(!E.innValid(''));
});

t('Склонения', () => {
  assert.strictEqual(E.plural(1, 'год', 'года', 'лет'), 'год');
  assert.strictEqual(E.plural(3, 'год', 'года', 'лет'), 'года');
  assert.strictEqual(E.plural(11, 'год', 'года', 'лет'), 'лет');
  assert.strictEqual(E.plural(21, 'год', 'года', 'лет'), 'год');
  assert.strictEqual(E.plural(114, 'год', 'года', 'лет'), 'лет');
});

t('Возраст компании', () => {
  assert.strictEqual(E.age('2021-03-15', '2026-09-25').text, '5 лет 6 месяцев');
  assert.strictEqual(E.age('2026-02-01', '2026-09-25').text, '7 месяцев');
  assert.strictEqual(E.age('2025-09-26', '2026-09-25').text, '11 месяцев');
  assert.strictEqual(E.age('2025-09-25', '2026-09-25').text, '1 год');
  assert.strictEqual(E.age('2030-01-01', '2026-09-25'), null);
  assert.strictEqual(E.age('мусор'), null);
});

const base = JSON.parse(JSON.stringify(E.DEMO));

t('Отпечаток: 6 знаков алфавита Крокфорда, стабилен', () => {
  const a = E.fingerprint(base);
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{6}$/);
  assert.strictEqual(E.fingerprint(JSON.parse(JSON.stringify(base))), a);
});

t('Отпечаток не зависит от порядка признаков и мелких деталей', () => {
  const b = JSON.parse(JSON.stringify(base));
  b.signals.reverse();
  b.signals[0].detail = 'другая формулировка';
  b.checked_at = '2030-01-01';
  assert.strictEqual(E.fingerprint(b), E.fingerprint(base));
});

t('Отпечаток меняется при существенных изменениях', () => {
  const a = E.fingerprint(base);
  const s = JSON.parse(JSON.stringify(base)); s.signals[4].status = 'bad';
  const st = JSON.parse(JSON.stringify(base)); st.company.status = 'LIQUIDATING';
  const z = JSON.parse(JSON.stringify(base)); z.zsk.level = 'high';
  const add = JSON.parse(JSON.stringify(base)); add.signals.push({ title: 'Исполнительные производства', status: 'warn' });
  [s, st, z, add].forEach(x => assert.notStrictEqual(E.fingerprint(x), a));
});

t('Нормализация отпечатка с бумаги: O→0, I/L→1, дефисы и регистр', () => {
  assert.strictEqual(E.fpNormalize('7kq-m2d'), '7KQM2D');
  assert.strictEqual(E.fpNormalize('OIL‑123'), '011123');
  assert.strictEqual(E.fpPretty('7KQM2D'), '7KQ‑M2D');
});

t('Сверка с бумажной копией', () => {
  const code = E.fingerprint(base);
  assert.deepStrictEqual(E.compare({}, code), { state: 'none' });
  assert.strictEqual(E.compare({ f: code, d: '20260925' }, code).state, 'same');
  assert.strictEqual(E.compare({ f: code.toLowerCase(), d: '20260925' }, code).state, 'same');
  const ch = E.compare({ f: 'ZZZZZZ', d: '20260925' }, code);
  assert.strictEqual(ch.state, 'changed');
  assert.strictEqual(ch.printed.getDate(), 25);
  assert.strictEqual(E.compare({ f: 'ABC' }, code).state, 'none');
  assert.strictEqual(E.parseYmd('20260231'), null);
});

t('Раскладка признаков для партнёра', () => {
  const g = E.classify(Object.assign({}, base, { checked_at: '2026-09-25' }));
  assert.strictEqual(g.real[0].title, 'Работает');
  assert.ok(g.real.some(x => /численность/.test(x.title)));
  assert.ok(g.real.some(x => /налоги/i.test(x.title)));
  assert.ok(g.clean.some(x => /Дисквалифицированные/.test(x.title)));
  assert.strictEqual(g.ask.length, 1);
  assert.strictEqual(g.serious.length, 0);
  assert.strictEqual(g.info.length, 1);
});

t('Ликвидация и высокий ЗСК — серьёзные отметки', () => {
  const r = JSON.parse(JSON.stringify(base)); r.company.status = 'LIQUIDATING'; r.zsk.level = 'high';
  const g = E.classify(r);
  assert.strictEqual(g.serious[0].detail, 'Ликвидируется');
  assert.ok(g.serious.some(x => x.title === 'Прогноз ЗСК'));
  assert.strictEqual(E.headline(g).tone, 'bad');
});

t('Заголовок: три честных тона и склонения', () => {
  assert.strictEqual(E.headline({ serious: [], ask: [] }).tone, 'ok');
  const w = E.headline({ serious: [], ask: [1, 2] });
  assert.strictEqual(w.tone, 'warn');
  assert.ok(w.title.includes('2 момента'));
  const b = E.headline({ serious: [1], ask: [1, 2, 3, 4, 5] });
  assert.ok(b.text.includes('1 отметка') && b.text.includes('5 моментов'));
});

t('Ссылка для QR укладывается в версию 6-Q (линза в центре остаётся)', () => {
  const code = E.fingerprint(base);
  const u10 = E.passportUrl('https://deloskop.ru', '4826147043', code, new Date(2026, 8, 25));
  const u12 = E.passportUrl('https://deloskop.ru', '500100732259', code, new Date(2026, 8, 25));
  assert.strictEqual(u10, 'https://deloskop.ru/pasport/?inn=4826147043&d=20260925&f=' + code);
  assert.ok(Q.matrix(u10, 'Q').version <= 6);
  assert.ok(Q.matrix(u12, 'Q').version <= 6);
});

t('QR: размеры, служебные узоры, отказ на слишком длинном тексте', () => {
  const m = Q.matrix('HELLO', 'M');
  assert.strictEqual(m.size, 21);
  // угловой искатель: тёмная рамка 7×7 и светлый разделитель
  for (let i = 0; i < 7; i++) { assert.ok(m.dark[0][i]); assert.ok(m.dark[6][i]); assert.ok(m.dark[i][0]); }
  assert.ok(!m.dark[7][0] && !m.dark[0][7]);
  assert.ok(m.dark[m.size - 8][8], 'тёмный модуль на месте');
  assert.throws(() => Q.matrix('x'.repeat(300), 'H'));
  const svg = Q.svg('https://deloskop.ru/pasport/?inn=4826147043&d=20260925&f=7KQM2D');
  assert.ok(svg.startsWith('<svg') && svg.includes('fill="#0B63E5"'));
});

console.log('\nВсе тесты пройдены: ' + n);
