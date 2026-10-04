// «Реквизиты проверки» (js/rekvizity-proverki.js) — строка реквизитов под шапкой отчёта на экране проверки по ИНН.
// node --test tests/rekvizity_proverki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../js/rekvizity-proverki.js');
const KOREN = path.join(__dirname, '..');
const NB = '\u00a0';

// Форма живого ответа /api/check (поля — как у API; компания вымышленная)
function otvet(over) {
  return Object.assign({
    report_id: 'a1b2c3d4e5',
    company: { inn: '7700000001', kind: 'LEGAL', status: 'ACTIVE', director_name: 'Иванов Иван Иванович', address: 'г Москва, ул Примерная, д 1' },
    risk_level: 'low', checked_at: '2026-10-01T22:30:00Z',
    signals: [
      { title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные: задолженность', as_of: '01.09.2026' },
      { title: 'Численность', status: 'ok', detail: '12 человек', source: 'ФНС, открытые данные', as_of: '2026-09-25' },
    ],
    dossier: { charts: { revenue: [{ year: 2023, value: 100 }, { year: 2025, value: 130 }, { year: 2024, value: 120 }] } },
  }, over || {});
}

test('дата и время проверки — по Москве (22:30 UTC = 01:30 следующего дня)', () => {
  const o = R.sobrat(otvet());
  assert.strictEqual(o.data, '02.10.2026');
  assert.strictEqual(o.vremya, '01:30');
  assert.strictEqual(o.nomer, 'a1b2c3d4e5');
});

test('самые давние сведения — самая ранняя дата «на …» и её источник без уточнения после двоеточия', () => {
  const o = R.sobrat(otvet());
  assert.deepStrictEqual(o.davnie, { data: '01.09.2026', istochnik: 'ФНС, открытые данные' });
});

test('дата сведений позже проверки не берётся; всё на день проверки — строки нет', () => {
  const r = otvet({ signals: [{ title: 'x', status: 'ok', source: 'ФНС', as_of: '2026-12-31' }, { title: 'y', status: 'ok', source: 'ЕГРЮЛ', as_of: '02.10.2026' }] });
  assert.strictEqual(R.sobrat(r).davnie, null);
  assert.ok(!R.html(r).includes('Самые давние'));
});

test('бухотчётность — последний год ряда ГИР БО; нет ряда — строки нет', () => {
  assert.strictEqual(R.sobrat(otvet()).otchetnost, 2025);
  const r = otvet({ dossier: {} });
  assert.strictEqual(R.sobrat(r).otchetnost, null);
  assert.ok(!R.html(r).includes('Бухотчётность'));
});

test('номер проверки — только безопасные символы; нет номера — строки «Проверка №» нет', () => {
  assert.strictEqual(R.sobrat(otvet({ report_id: '<script>' })).nomer, '');
  const h = R.html(otvet({ report_id: undefined }));
  assert.ok(!h.includes('Проверка №'));
  assert.ok(h.includes('Проверено'));
});

test('вёрстка: dl с реквизитами, МСК через неразрывный пробел, год — через неразрывный', () => {
  const h = R.html(otvet());
  assert.ok(h.startsWith('<dl class="rkv">'));
  assert.ok(h.includes('02.10.2026, 01:30' + NB + 'МСК'));
  assert.ok(h.includes('за 2025' + NB + 'год'));
  assert.ok(h.includes('<span class="rkv__nom">a1b2c3d4e5</span>'));
});

test('пустой ответ, ответ без компании или без даты и номера — пусто, отчёт не ломается', () => {
  assert.strictEqual(R.html(null), '');
  assert.strictEqual(R.html({}), '');
  assert.strictEqual(R.html({ company: {} }), '');
});

test('без ФИО и адреса: в реквизиты персональные данные не попадают', () => {
  const h = R.html(otvet());
  assert.ok(!h.includes('Иванов'));
  assert.ok(!h.includes('Примерная'));
});

test('печать: отчёт печатается без шапки сайта, кнопок и с цветами светофора', () => {
  assert.ok(R.CSS.includes('@media print'));
  assert.ok(R.CSS.includes('.rkv-skryt{display:none!important}'));
  assert.ok(R.CSS.includes('.report-actions'));
  assert.ok(R.CSS.includes('print-color-adjust:exact'));
  assert.ok(R.CSS.includes('tabular-nums'));
});

test('index.html подключает модуль и зовёт его после «Откуда данные»', () => {
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.ok(s.includes('<script src="/js/rekvizity-proverki.js" defer></script>'));
  const i = s.indexOf('Otkuda.mount('), j = s.indexOf('RekvizityProverki.mount(report,r,{polucheno:new Date()})');
  assert.ok(i > 0 && j > i);
});

test('тексты без обещаний и превосходных степеней', () => {
  const s = fs.readFileSync(path.join(KOREN, 'js/rekvizity-proverki.js'), 'utf8');
  for (const w of ['гарантир', 'лучш', 'самый надёжн', '100%', 'искусствен']) assert.ok(!s.toLowerCase().includes(w), w);
});
